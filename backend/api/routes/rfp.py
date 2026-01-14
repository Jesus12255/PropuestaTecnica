"""
Endpoints para gestión de RFPs.
Usa almacenamiento híbrido (GCS con fallback local).
"""
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_user
from core.storage import get_storage_service
from core.services.analyzer import get_analyzer_service
from core.services.mcp_client import get_mcp_client, convert_team_estimation_to_mcp_roles
from models.rfp import RFPSubmission, RFPQuestion, RFPStatus
from models.user import User
from models.schemas import (
    RFPSummary,
    RFPDetail,
    RFPDecision,
    UploadResponse,
    RFPListResponse,
    RFPQuestion as RFPQuestionSchema,
    TeamSuggestionRequest,
    TeamSuggestionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rfp", tags=["RFP"])


# ============ UPLOAD ============

@router.post("/upload", response_model=UploadResponse)
async def upload_rfp(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sube un archivo RFP y realiza el análisis con Gemini.
    
    - Acepta PDF y DOCX
    - Guarda localmente (o GCS si está disponible)
    - Realiza análisis SÍNCRONO (espera a que termine)
    - Retorna cuando el análisis está completo
    """
    # Validar tipo de archivo
    allowed_types = [
        "application/pdf", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no soportado. Permitidos: PDF, DOCX"
        )
    
    # Leer contenido
    content = await file.read()
    file_size = len(content)
    
    # Obtener nombre de archivo
    filename = file.filename or "documento_sin_nombre.pdf"
    content_type = file.content_type or "application/pdf"
    
    # Guardar en storage (híbrido: GCS o local)
    storage = get_storage_service()
    file_uri = storage.upload_file(
        file_content=content,
        file_name=filename,
        content_type=content_type,
    )
    
    # Crear registro en BD
    rfp = RFPSubmission(
        file_name=filename,
        file_gcs_path=file_uri,
        file_size_bytes=file_size,
        status=RFPStatus.ANALYZING.value,  # Directamente analyzing
    )
    db.add(rfp)
    await db.commit()
    await db.refresh(rfp)
    
    # Obtener modo de análisis de las preferencias del usuario
    user_prefs = current_user.preferences or {}
    analysis_mode = user_prefs.get("analysis_mode", "balanced")
    logger.info(f"Using analysis mode: {analysis_mode} (from user preferences)")
    
    # Realizar análisis SÍNCRONO
    try:
        analyzer = get_analyzer_service()
        extracted_data = await analyzer.analyze_rfp_from_content(
            content, 
            filename,
            analysis_mode=analysis_mode,
            db=db,
        )
        
        # Extraer campos indexados
        indexed_fields = analyzer.extract_indexed_fields(extracted_data)
        
        # Actualizar RFP con resultados
        rfp.extracted_data = extracted_data
        rfp.status = RFPStatus.ANALYZED.value
        rfp.analyzed_at = datetime.utcnow()
        
        for field, value in indexed_fields.items():
            setattr(rfp, field, value)
        
        # Guardar recommended_isos en su columna específica
        if "recommended_isos" in extracted_data:
            rfp.recommended_isos = extracted_data["recommended_isos"]
        
        await db.commit()
        await db.refresh(rfp)
        
        logger.info(f"RFP analysis completed: {rfp.id}")
        
        return UploadResponse(
            id=rfp.id,
            file_name=filename,
            status=RFPStatus.ANALYZED.value,
            message="RFP subido y analizado exitosamente.",
        )
        
    except Exception as e:
        logger.error(f"Error analyzing RFP {rfp.id}: {e}")
        rfp.status = RFPStatus.ERROR.value
        await db.commit()
        
        raise HTTPException(
            status_code=500,
            detail=f"Error al analizar el RFP: {str(e)}"
        )


async def analyze_rfp_task(rfp_id: str, file_uri: str, file_content: bytes):
    """Task en background para analizar el RFP."""
    from core.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        rfp = None
        try:
            # Obtener RFP
            result = await db.execute(
                select(RFPSubmission).where(RFPSubmission.id == rfp_id)
            )
            rfp = result.scalar_one_or_none()
            
            if not rfp:
                logger.error(f"RFP not found: {rfp_id}")
                return
            
            # Actualizar status
            rfp.status = RFPStatus.ANALYZING.value
            await db.commit()
            
            # Analizar con Gemini
            analyzer = get_analyzer_service()
            extracted_data = await analyzer.analyze_rfp_from_content(file_content, rfp.file_name, db=db)
            
            # Extraer campos indexados
            indexed_fields = analyzer.extract_indexed_fields(extracted_data)
            
            # Actualizar RFP
            rfp.extracted_data = extracted_data
            rfp.status = RFPStatus.ANALYZED.value
            rfp.analyzed_at = datetime.utcnow()
            
            for field, value in indexed_fields.items():
                setattr(rfp, field, value)
            
            # Guardar recommended_isos en su columna específica
            if "recommended_isos" in extracted_data:
                rfp.recommended_isos = extracted_data["recommended_isos"]
            
            await db.commit()
            logger.info(f"RFP analysis completed: {rfp_id}")
            
        except Exception as e:
            logger.error(f"Error analyzing RFP {rfp_id}: {e}")
            if rfp:
                rfp.status = RFPStatus.ERROR.value
                await db.commit()


# ============ DOWNLOAD ============

@router.get("/{rfp_id}/download")
async def download_rfp(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Descarga el archivo original del RFP.
    """
    result = await db.execute(
        select(RFPSubmission).where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    storage = get_storage_service()
    file_path = storage.get_file_path(rfp.file_gcs_path)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    # Determinar media type
    media_type = "application/pdf"
    if rfp.file_name.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    return FileResponse(
        path=str(file_path),
        filename=rfp.file_name,
        media_type=media_type,
    )


# ============ LIST & DETAIL ============

@router.get("", response_model=RFPListResponse)
async def list_rfps(
    current_user: User = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todos los RFPs con paginación y filtros.
    """
    # Query base
    query = select(RFPSubmission).order_by(RFPSubmission.created_at.desc())
    count_query = select(func.count(RFPSubmission.id))
    
    # Filtros
    if status:
        query = query.where(RFPSubmission.status == status)
        count_query = count_query.where(RFPSubmission.status == status)
    
    if category:
        query = query.where(RFPSubmission.category == category)
        count_query = count_query.where(RFPSubmission.category == category)
    
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            RFPSubmission.client_name.ilike(search_filter) |
            RFPSubmission.summary.ilike(search_filter)
        )
        count_query = count_query.where(
            RFPSubmission.client_name.ilike(search_filter) |
            RFPSubmission.summary.ilike(search_filter)
        )
    
    # Paginación
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Ejecutar queries
    result = await db.execute(query)
    rfps = result.scalars().all()
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    return RFPListResponse(
        items=[RFPSummary.model_validate(rfp) for rfp in rfps],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{rfp_id}", response_model=RFPDetail)
async def get_rfp(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene el detalle de un RFP incluyendo el análisis y preguntas.
    """
    result = await db.execute(
        select(RFPSubmission)
        .options(selectinload(RFPSubmission.questions))
        .where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    return RFPDetail.model_validate(rfp)


# ============ DECISION ============

@router.post("/{rfp_id}/decision", response_model=RFPDetail)
async def make_decision(
    rfp_id: UUID,
    decision: RFPDecision,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Registra la decisión GO/NO GO para un RFP.
    
    - Si es GO, genera preguntas para el cliente
    - Si es NO GO, archiva el RFP
    """
    result = await db.execute(
        select(RFPSubmission)
        .options(selectinload(RFPSubmission.questions))
        .where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    if rfp.status not in [RFPStatus.ANALYZED.value, RFPStatus.GO.value, RFPStatus.NO_GO.value]:
        raise HTTPException(
            status_code=400,
            detail="El RFP debe estar analizado antes de tomar una decisión"
        )
    
    # Actualizar decisión
    rfp.decision = decision.decision
    rfp.decision_reason = decision.reason
    rfp.decided_at = datetime.utcnow()
    rfp.status = RFPStatus.GO.value if decision.decision == "go" else RFPStatus.NO_GO.value
    
    # Si es GO, generar preguntas en background
    if decision.decision == "go" and rfp.extracted_data:
        background_tasks.add_task(
            generate_questions_task, 
            str(rfp.id), 
            rfp.extracted_data
        )
    
    await db.commit()
    await db.refresh(rfp)
    
    return RFPDetail.model_validate(rfp)


async def generate_questions_task(rfp_id: str, extracted_data: dict):
    """Task en background para generar preguntas."""
    from core.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            analyzer = get_analyzer_service()
            questions = await analyzer.generate_questions(extracted_data)
            
            # Obtener RFP
            result = await db.execute(
                select(RFPSubmission).where(RFPSubmission.id == rfp_id)
            )
            rfp = result.scalar_one_or_none()
            
            if not rfp:
                return
            
            # Crear preguntas en BD
            for q in questions:
                question = RFPQuestion(
                    rfp_id=rfp.id,
                    question=q.get("question", ""),
                    category=q.get("category"),
                    priority=q.get("priority"),
                    context=q.get("context"),
                    why_important=q.get("why_important"),
                )
                db.add(question)
            
            await db.commit()
            logger.info(f"Generated {len(questions)} questions for RFP {rfp_id}")
            
        except Exception as e:
            logger.error(f"Error generating questions for RFP {rfp_id}: {e}")


# ============ QUESTIONS ============

@router.get("/{rfp_id}/questions", response_model=list[RFPQuestionSchema])
async def get_questions(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene las preguntas generadas para un RFP.
    """
    result = await db.execute(
        select(RFPQuestion)
        .where(RFPQuestion.rfp_id == rfp_id)
        .order_by(RFPQuestion.priority.desc(), RFPQuestion.created_at)
    )
    questions = result.scalars().all()
    
    return [RFPQuestionSchema.model_validate(q) for q in questions]


@router.post("/{rfp_id}/questions/regenerate", response_model=list[RFPQuestionSchema])
async def regenerate_questions(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Regenera las preguntas para un RFP.
    """
    result = await db.execute(
        select(RFPSubmission)
        .options(selectinload(RFPSubmission.questions))
        .where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    if not rfp.extracted_data:
        raise HTTPException(status_code=400, detail="RFP no tiene datos de análisis")
    
    # Eliminar preguntas existentes
    for q in rfp.questions:
        await db.delete(q)
    
    # Generar nuevas preguntas
    analyzer = get_analyzer_service()
    questions = await analyzer.generate_questions(rfp.extracted_data)
    
    # Crear en BD
    new_questions = []
    for q in questions:
        question = RFPQuestion(
            rfp_id=rfp.id,
            question=q.get("question", ""),
            category=q.get("category"),
            priority=q.get("priority"),
            context=q.get("context"),
            why_important=q.get("why_important"),
        )
        db.add(question)
        new_questions.append(question)
    
    await db.commit()
    
    return [RFPQuestionSchema.model_validate(q) for q in new_questions]


# ============ DELETE ============

@router.delete("/{rfp_id}")
async def delete_rfp(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Elimina un RFP y su archivo local.
    """
    result = await db.execute(
        select(RFPSubmission).where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    # Eliminar archivo local
    try:
        storage = get_storage_service()
        storage.delete_file(rfp.file_gcs_path)
    except Exception as e:
        logger.warning(f"Failed to delete local file: {e}")
    
    # Eliminar de BD (cascade eliminará las preguntas)
    await db.delete(rfp)
    await db.commit()
    
    return {"message": "RFP eliminado exitosamente"}


# ============ STORAGE STATS ============

@router.get("/storage/stats")
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene estadísticas del almacenamiento local.
    """
    storage = get_storage_service()
    return storage.get_storage_stats()


# ============ TEAM SUGGESTION ============

@router.post("/{rfp_id}/suggest-team")
async def suggest_team(
    rfp_id: UUID,
    request: TeamSuggestionRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sugiere equipo real basado en el análisis del RFP.
    Conecta con MCP Talent Search para traer candidatos de TIVIT.
    
    El análisis incluye:
    - team_estimation: Roles, skills, certificaciones requeridas
    - cost_estimation: Costos estimados con tarifas de mercado (grounding)
    - suggested_team: Candidatos reales de TIVIT
    
    Los 4 escenarios:
    - A: Cliente define equipo + presupuesto -> Validar viabilidad
    - B: Sin equipo + con presupuesto -> IA sugiere equipo
    - C: Con equipo + sin presupuesto -> Estimar presupuesto
    - D: Sin equipo + sin presupuesto -> IA sugiere todo
    """
    force_refresh = request.force_refresh if request else False
    
    # Obtener RFP
    result = await db.execute(
        select(RFPSubmission).where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    if not rfp.extracted_data:
        raise HTTPException(
            status_code=400, 
            detail="RFP no tiene datos de análisis. Debe analizarse primero."
        )
    
    # Verificar si ya tiene team_estimation
    team_estimation = rfp.extracted_data.get("team_estimation")
    cost_estimation = rfp.extracted_data.get("cost_estimation")
    suggested_team = rfp.extracted_data.get("suggested_team")
    
    if not team_estimation:
        raise HTTPException(
            status_code=400,
            detail="RFP no tiene estimación de equipo. Vuelva a analizar el documento."
        )
    
    # Si ya tiene suggested_team y no se fuerza refresh, retornarlo
    if suggested_team and not force_refresh:
        logger.info(f"Returning cached suggested team for RFP {rfp_id}")
        return {
            "rfp_id": rfp_id,
            "scenario": team_estimation.get("scenario", "D"),
            "team_estimation": team_estimation,
            "cost_estimation": cost_estimation,
            "suggested_team": suggested_team,
            "message": "Equipo sugerido (cache)",
        }
    
    # Obtener país del RFP
    country = rfp.extracted_data.get("country") or rfp.country or "Chile"
    
    # Convertir team_estimation a formato MCP
    mcp_roles = convert_team_estimation_to_mcp_roles(team_estimation, country)
    
    if not mcp_roles:
        raise HTTPException(
            status_code=400,
            detail="No se encontraron roles en la estimación de equipo."
        )
    
    logger.info(f"Searching candidates for {len(mcp_roles)} roles in {country}")
    
    # Verificar disponibilidad de MCP
    mcp_client = get_mcp_client()
    mcp_available = await mcp_client.health_check()
    
    if not mcp_available:
        logger.warning("MCP server not available, returning estimation only")
        return {
            "rfp_id": rfp_id,
            "scenario": team_estimation.get("scenario", "D"),
            "team_estimation": team_estimation,
            "cost_estimation": cost_estimation,
            "suggested_team": {
                "mcp_available": False,
                "error": "MCP Talent Search no disponible",
                "resultados": {},
                "total_candidatos": 0,
            },
            "message": "MCP no disponible. Solo se muestra estimación.",
        }
    
    # Llamar a MCP
    try:
        mcp_results = await mcp_client.search_team(mcp_roles)
        
        # Agregar metadata
        mcp_results["generated_at"] = datetime.utcnow().isoformat()
        mcp_results["mcp_available"] = True
        
        # Calcular cobertura
        roles_with_candidates = sum(
            1 for r in mcp_results.get("resultados", {}).values() 
            if r.get("total", 0) > 0
        )
        total_roles = len(mcp_roles)
        mcp_results["coverage_percent"] = (
            (roles_with_candidates / total_roles * 100) if total_roles > 0 else 0
        )
        
        # Guardar en extracted_data
        rfp.extracted_data["suggested_team"] = mcp_results
        rfp.updated_at = datetime.utcnow()
        await db.commit()
        
        logger.info(
            f"Found {mcp_results.get('total_candidatos', 0)} candidates "
            f"for {total_roles} roles"
        )
        
        return {
            "rfp_id": rfp_id,
            "scenario": team_estimation.get("scenario", "D"),
            "team_estimation": team_estimation,
            "cost_estimation": cost_estimation,
            "suggested_team": mcp_results,
            "message": f"Equipo sugerido con {mcp_results.get('total_candidatos', 0)} candidatos",
        }
        
    except Exception as e:
        logger.error(f"Error calling MCP: {e}")
        return {
            "rfp_id": rfp_id,
            "scenario": team_estimation.get("scenario", "D"),
            "team_estimation": team_estimation,
            "cost_estimation": cost_estimation,
            "suggested_team": {
                "mcp_available": False,
                "error": str(e),
                "resultados": {},
                "total_candidatos": 0,
            },
            "message": f"Error al buscar candidatos: {str(e)}",
        }


@router.get("/{rfp_id}/team-estimation")
async def get_team_estimation(
    rfp_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene la estimación de equipo, costos y candidatos sugeridos de un RFP.
    No llama a MCP, solo retorna los datos guardados del análisis.
    """
    result = await db.execute(
        select(RFPSubmission).where(RFPSubmission.id == rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    if not rfp.extracted_data:
        raise HTTPException(status_code=400, detail="RFP no tiene datos de análisis")
    
    return {
        "rfp_id": rfp_id,
        "team_estimation": rfp.extracted_data.get("team_estimation"),
        "cost_estimation": rfp.extracted_data.get("cost_estimation"),
        "suggested_team": rfp.extracted_data.get("suggested_team"),
    }
