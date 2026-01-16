"""
Endpoints para capítulos.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.services.analyzer import get_analyzer_service
from core.database import get_db
from core.storage import get_storage_service
from models.chapter import Chapter
from models.rfp import RFPSubmission
from models.schemas.chapter_schemas import ChapterRecommendationRequest, ChapterRecommendation
from typing import List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chapters", tags=["Chapters"])

@router.get("/")
async def list_chapters(db: AsyncSession = Depends(get_db)):
    """Listar todos los capítulos activos."""
    result = await db.execute(select(Chapter).where(Chapter.is_active == True))
    items = result.scalars().all()
    return items

@router.post("/save")
async def create_chapter(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    
    # Validar extensión .docx
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400, 
            detail="Solo se permiten archivos Word (.docx)"
        )

    # Validar tamaño (Máximo 10MB)
    MAX_SIZE = 10 * 1024 * 1024
    content = await file.read()
    
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="El archivo excede el tamaño máximo permitido (10MB)"
        )

    # 2. Analizar con AI
    analyzer = get_analyzer_service()
    extracted_data = await analyzer.analyze_chapter_content(content, file.filename)
    
    # Validar si es contenido válido
    if extracted_data.get("isValid") is False:
        raise HTTPException(
            status_code=400,
            detail=f"Documento rechazado: {extracted_data.get('reason', 'No parece ser un capítulo de propuesta válido')}"
        )
    
    # 3. Guardar archivo físico
    storage = get_storage_service()
    # Reset del cursor del archivo para subirlo
    await file.seek(0)
    
    file_uri = storage.upload_file_object(
        file.file,
        file_name=file.filename,
        content_type=file.content_type,
        folder="templates/chapters"
    )

    # 4. Crear registro en BD con datos extraídos
    chapter_name = extracted_data.get("name") or file.filename
    chapter_desc = extracted_data.get("description") or f"Capítulo cargado: {file.filename}"
    
    chapter = Chapter(
        name=chapter_name,
        filename=file.filename,
        location=file_uri,
        description=chapter_desc
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    
    return {"message": "Capítulo cargado exitosamente", "id": chapter.id}


    return {"message": "Capítulo cargado exitosamente", "id": chapter.id}


@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: str, db: AsyncSession = Depends(get_db)):
    """Eliminar un capítulo por ID."""
    from uuid import UUID
    try:
        chap_uuid = UUID(chapter_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de capítulo inválido")

    result = await db.execute(select(Chapter).where(Chapter.id == chap_uuid))
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
        
    from sqlalchemy import delete
    await db.execute(delete(Chapter).where(Chapter.id == chap_uuid))
    await db.commit()
    
    return {"message": "Capítulo eliminado exitosamente"}


@router.post("/recommendations", response_model=List[ChapterRecommendation])
async def get_chapter_recommendations(
    request: ChapterRecommendationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Genera recomendaciones de capítulos basadas en el RFP.
    """
    try:
        # 1. Fetch RFP Summary
        rfp_result = await db.execute(select(RFPSubmission).where(RFPSubmission.id == request.rfp_id))
        rfp = rfp_result.scalar_one_or_none()
        
        if not rfp:
            raise HTTPException(status_code=404, detail="RFP not found")

        # 2. Fetch All Active Chapters
        chap_result = await db.execute(select(Chapter).where(Chapter.is_active == True))
        chapters = chap_result.scalars().all()
        
        if not chapters:
            return []

        # 3. Format data for Analyzer
        rfp_summary = f"Title: {rfp.title or rfp.file_name}\nSummary: {rfp.summary or 'No summary available'}"
        chap_list = [
            {
                "id": str(c.id),
                "name": c.name,
                "description": c.description
            } 
            for c in chapters
        ]

        # 4. Call AI Analyzer
        analyzer = get_analyzer_service()
        recommendations = await analyzer.analyze_chapter_relevance(rfp_summary, chap_list)
        
        return recommendations

    except Exception as e:
        logger.error(f"Error generating chapter recommendations: {e}")
        return []
