"""
Endpoints para la generación de propuestas.
"""
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.services.proposal_generator import get_proposal_generator
from models.rfp import RFPSubmission
from models.user import User
from schemas.proposal import ProposalGenerationRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proposal", tags=["Proposal"])

@router.post("/generate")
async def generate_proposal(
    request: ProposalGenerationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
    ):

    result = await db.execute(
        select(RFPSubmission).where(RFPSubmission.id == request.rfp_id)
    )
    rfp = result.scalar_one_or_none()
    
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP no encontrado")
    
    if not rfp.extracted_data:
        raise HTTPException(
            status_code=400, 
            detail="El RFP no ha sido analizado o no tiene datos extraídos."
        )
    
    try:
        # Fetch locations (URIs) for selected certifications
        cert_locations = []
        if request.certification_ids:
            from models.certification import Certification
            cert_result = await db.execute(
                select(Certification.location)
                .where(Certification.id.in_(request.certification_ids))
                .where(Certification.is_active == True)
            )
            # Filter out None values just in case
            cert_locations = [loc for loc in cert_result.scalars().all() if loc]

        experiences = []
        if request.experience_ids:
            logger.info(f"Recibidos IDs de experiencia: {request.experience_ids}")
            from models.experience import Experience
            exp_result = await db.execute(
                select(Experience)
                .where(Experience.id.in_(request.experience_ids))
            )
            # Use scalars().all() to get the list of Experience objects
            experiences = list(exp_result.scalars().all())
            logger.info(f"Encontradas {len(experiences)} experiencias en DB.")

        # Fetch locations for selected chapters
        chapter_locations = []
        if getattr(request, "chapter_ids", None): # Check if field exists in schema
             logger.info(f"Recibidos IDs de capítulos: {request.chapter_ids}")
             from models.chapter import Chapter
             chap_result = await db.execute(
                 select(Chapter.location)
                 .where(Chapter.id.in_(request.chapter_ids))
                 .where(Chapter.is_active == True)
             )
             chapter_locations = [loc for loc in chap_result.scalars().all() if loc]
             logger.info(f"Encontradas {len(chapter_locations)} ubicaciones de capítulos: {chapter_locations}")

        generator = get_proposal_generator()
        
        rfp_data = {
            "extracted_data": rfp.extracted_data
        }
        
        # 1. Obtener el contexto (datos)
        context_data = generator.prepare_context(
            rfp_data, 
            user_name=user.full_name,
            certification_locations=list(cert_locations),
            experiences=experiences,
            chapter_locations=list(chapter_locations)
        ) 
        
        # 2. Generar el DOCX
        docx_stream = generator.generate_docx(context_data)
        
        filename = f"Propuesta_{rfp.client_name or 'TIVIT'}_{datetime.now().strftime('%Y%m%d')}.docx"
        
        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error creating proposal for RFP {rfp.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando la propuesta: {e}")
