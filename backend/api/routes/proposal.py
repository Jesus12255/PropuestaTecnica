from core.services.storage_service import get_folder_children
from core.services.storage_service import create_folder
from core.services.storage_service import create_file
from core.services.storage_service import get_user_folder
import uuid
from utils.constantes import Constantes
from core.storage import get_storage_service
import logging
from datetime import datetime
from uuid import UUID
import unicodedata
import re
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
            rfp,
            user_name=user.full_name,
            certification_locations=list(cert_locations),
            experiences=experiences,
            chapter_locations=list(chapter_locations)
        ) 
        
        # 2. Generar el DOCX
        docx_stream = generator.generate_docx(context_data)
        
        # Capturar bytes para guardar copia
        file_content = docx_stream.getvalue()
        docx_stream.seek(0) # Resetear puntero para la descarga posterior
        
        # Sanitize filename (remove accents, etc)
        client_clean = rfp.client_name or 'TIVIT'
        # Normalize to NFKD to separate accents
        client_clean = unicodedata.normalize('NFKD', client_clean).encode('ASCII', 'ignore').decode('ASCII')
        # Replace remaining non-safe chars
        client_clean = re.sub(r'[^\w\-_.]', '_', client_clean)
        
        filename = f"Propuesta_{client_clean}_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4()}.docx"
        
        # Guardar copia en el storage
        await _guardar_propuesta(rfp, file_content, filename, user, db)
        
        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error creating proposal for RFP {rfp.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando la propuesta: {e}")


async def _guardar_propuesta(rfp: RFPSubmission, file_content: bytes, filename: str, user: User, db: AsyncSession):
    try:
        storage = get_storage_service()
        folder = Constantes.Storage.PROPOSALS
        
        uri = storage.upload_file(
            file_content=file_content,
            file_name=filename,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            folder=folder
        )

        carpeta_go = await get_user_folder(db, user.id, Constantes.Storage.GO)
        if not carpeta_go:
             raise HTTPException(status_code=404, detail="Carpeta GO no encontrada")

        carpeta_tvt = await get_user_folder(db, user.id, rfp.tvt, parent_id=carpeta_go.carpeta_id)
        if not carpeta_tvt:
            raise HTTPException(status_code=404, detail=f"Carpeta con TVT {rfp.tvt} no encontrada dentro de GO")

        carpeta_propuestas = await get_user_folder(db, user.id, Constantes.Storage.PROPOSALS, parent_id=carpeta_tvt.carpeta_id)
        
        if not carpeta_propuestas:
            carpeta_propuestas = await create_folder(
                db=db,
                name=Constantes.Storage.PROPOSALS,
                parent_id=carpeta_tvt.carpeta_id
            )
        
        versiones_propuesta = await get_folder_children(db, carpeta_propuestas.carpeta_id)

        carpeta_version_propuesta = await create_folder(
            db=db,
            name=Constantes.Storage.VERSION + Constantes.UNDERSCORE + str(len(versiones_propuesta) + 1),
            parent_id=carpeta_propuestas.carpeta_id
        )

        await create_file(
            db=db,
            name=filename, 
            carpeta_id=carpeta_version_propuesta.carpeta_id, 
            url=uri
        )
    except Exception as e:
        logger.error(f"Error guardando respaldo de propuesta en storage: {e}")
        return None