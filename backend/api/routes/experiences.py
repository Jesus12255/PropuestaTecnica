from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.database import get_db
from models.experience import Experience
from models.rfp import RFPSubmission
from models.schemas.experience_schemas import ExperienceCreate, Experience as ExperienceSchema, ExperienceRecommendationRequest, ExperienceRecommendation
from core.services.analyzer import get_analyzer_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/experiences", tags=["experiences"])

@router.get("/", response_model=List[ExperienceSchema])
async def get_experiences(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Experience).order_by(Experience.fecha_inicio.desc()))
    return result.scalars().all()

@router.post("/", response_model=ExperienceSchema)
async def create_experience(experience: ExperienceCreate, db: AsyncSession = Depends(get_db)):
    new_experience = Experience(**experience.dict())
    db.add(new_experience)
    await db.commit()
    await db.refresh(new_experience)
    return new_experience

@router.put("/{experience_id}", response_model=ExperienceSchema)
async def update_experience(
    experience_id: UUID, 
    experience_update: ExperienceCreate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Experience).where(Experience.id == experience_id))
    experience = result.scalar_one_or_none()
    
    if not experience:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    # Update fields
    update_data = experience_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(experience, key, value)
    
    await db.commit()
    await db.refresh(experience)
    return experience

@router.delete("/{experience_id}")
async def delete_experience(experience_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Experience).where(Experience.id == experience_id))
    experience = result.scalar_one_or_none()
    if not experience:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    await db.execute(delete(Experience).where(Experience.id == experience_id))
    await db.commit()
    return {"message": "Experience deleted successfully"}
    await db.commit()
    return {"message": "Experience deleted successfully"}

@router.post("/recommendations", response_model=List[ExperienceRecommendation])
async def get_experience_recommendations(
    request: ExperienceRecommendationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Genera recomendaciones de experiencias basadas en el RFP.
    """
    try:
        # 1. Fetch RFP Summary
        rfp_result = await db.execute(select(RFPSubmission).where(RFPSubmission.id == request.rfp_id))
        rfp = rfp_result.scalar_one_or_none()
        
        if not rfp:
            raise HTTPException(status_code=404, detail="RFP not found")

        

        # 2. Fetch All Experiences
        exp_result = await db.execute(select(Experience))
        experiences = exp_result.scalars().all()
        
        if not experiences:
            return []

        # 3. Format data for Analyzer
        rfp_summary = f"Title: {rfp.title or rfp.file_name}\nSummary: {rfp.summary or 'No summary available'}"
        exp_list = [
            {
                "id": str(e.id),
                "propietario_servicio": e.propietario_servicio,
                "descripcion_servicio": e.descripcion_servicio,
                "monto_final": e.monto_final
            } 
            for e in experiences
        ]

        logger.info(f"info-rfp: {rfp_summary}")
        logger.info(f"info-exp: {exp_list}")

        # 4. Call AI Analyzer
        analyzer = get_analyzer_service()
        recommendations = await analyzer.analyze_experience_relevance(rfp_summary, exp_list)
        
        logger.info(f"AI Recommendations: {len(recommendations)} items returned. Content: {recommendations}")
        
        return recommendations

    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        # En caso de error, devolver lista vacía para no romper el front
        return []
