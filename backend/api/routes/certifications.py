"""
Endpoints para certificaciones.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from core.services.analyzer import get_analyzer_service
from core.database import get_db
from core.storage import get_storage_service
from models.certification import Certification

router = APIRouter(prefix="/certifications", tags=["Certifications"])

@router.get("/")
async def list_certifications(db: AsyncSession = Depends(get_db)):
    """Listar todas las certificaciones disponibles."""
    result = await db.execute(select(Certification).where(Certification.is_active == True))
    certs = result.scalars().all()
    return certs

@router.post("/save")
async def create_certification(
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
    extracted_data = await analyzer.analyze_certification_content(content, file.filename)
    
    # 3. Guardar archivo físico
    storage = get_storage_service()
    # Reset del cursor del archivo para subirlo
    await file.seek(0)
    
    file_uri = storage.upload_file_object(
        file.file,
        file_name=file.filename,
        content_type=file.content_type,
        folder="templates/certs"
    )

    # 4. Crear registro en BD con datos extraídos
    cert_name = extracted_data.get("name") or file.filename
    cert_desc = extracted_data.get("description") or f"Certificación cargada: {file.filename}"
    
    cert = Certification(
        name=cert_name,
        filename=file.filename,
        location=file_uri,
        description=cert_desc
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    
    return {"message": "Certificación cargada exitosamente", "id": cert.id}
