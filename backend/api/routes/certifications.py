"""
Endpoints para certificaciones.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.database import get_db
from models.certification import Certification

router = APIRouter(prefix="/certifications", tags=["Certifications"])

@router.get("/")
async def list_certifications(db: AsyncSession = Depends(get_db)):
    """Listar todas las certificaciones disponibles."""
    result = await db.execute(select(Certification).where(Certification.is_active == True))
    certs = result.scalars().all()
    return certs

@router.post("/")
async def create_certification(
    name: str, 
    filename: str, 
    description: str = "", 
    db: AsyncSession = Depends(get_db)
):
    """Crear una nueva certificación (principalmente para pruebas/seed)."""
    # En un caso real usaríamos Pydantic models
    cert = Certification(
        name=name,
        filename=filename,
        description=description
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert
