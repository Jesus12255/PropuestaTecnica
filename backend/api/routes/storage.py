"""
Endpoints para la gestión de Storage (Carpetas y Archivos estructurados).
"""
import uuid
import logging
import base64
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_user
from core.storage import get_storage_service
from models.user import User
from models.storage import Carpeta, Archivo, UsuarioCarpeta
from models.schemas.storage_schemas import CarpetaSchema, CarpetaDetailSchema, ArchivoSchema, FolderContentSchema

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/storage", tags=["Storage"])

@router.get("/files/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Descarga un archivo.
    """
    result = await db.execute(select(Archivo).where(Archivo.archivo_id == file_id))
    archivo = result.scalar_one_or_none()
    
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    storage = get_storage_service()
    
    # Check if URL is valid
    if not archivo.url:
        raise HTTPException(status_code=400, detail="El archivo no tiene URL válida")

    # Strategy: Redirect if GCS signed URL available, or FileResponse if local
    # Strategy: ALWAYS Proxy the content to avoid CORS
    # Instead of redirecting to GCS (which causes CORS on localhost), we stream the content through the backend.
    
    try:
        file_content = storage.download_file(archivo.url)
        
        # DEBUG & AUTO-FIX: Check for Base64 or Data URI encoding
        # Some files might have been saved as Base64 strings/Data URIs instead of binary.
        # We detect and fix this on-the-fly to ensure the client receives a valid binary file.
        
        # Check 1: Data URI (e.g. b"data:application/...")
        if file_content.startswith(b"data:"):
            try:
                logger.warning(f"File {file_id} appears to be a Data URI. Attempting to decode...")
                # Find the comma separator
                header, _, data_part = file_content.partition(b",")
                if data_part:
                    file_content = base64.b64decode(data_part)
                    logger.info("Successfully decoded Data URI to binary.")
            except Exception as e:
                logger.error(f"Failed to decode Data URI: {e}")

        # Check 2: Pure Base64 (starts with "UEsDB" -> "PK..")
        # Ensure we don't double-decode if it was already fixed above or is real binary
        elif file_content.startswith(b"UEsDB"):
             try:
                 logger.warning(f"File {file_id} appears to be Base64 encoded. Attempting to decode...")
                 # Verify if it's valid base64
                 decoded = base64.b64decode(file_content)
                 # Check if decoded starts with PK (Zip signature)
                 if decoded.startswith(b"PK"):
                     file_content = decoded
                     logger.info("Successfully decoded Base64 to binary.")
             except Exception as e:
                 logger.error(f"Failed to decode Base64: {e}")

        # Final sanity check log
        logger.info(f"Final content sample (first 4 bytes): {file_content[:4]}")
        
        # Determine media type (simple guess or default)
        media_type = "application/octet-stream"
        if archivo.nombre:
            if archivo.nombre.endswith(".pdf"):
                media_type = "application/pdf"
            elif archivo.nombre.endswith(".docx"):
                media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        
        from fastapi.responses import StreamingResponse
        import io
        
        return StreamingResponse(
            io.BytesIO(file_content), 
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{archivo.nombre}"'}
        )
        
    except Exception as e:
        logger.error(f"Error downloading file {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al descargar el archivo")
    raise HTTPException(status_code=404, detail="Archivo físico no encontrado")

@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: uuid.UUID,
    token: str | None = None, # Make explicit for Swagger UI if needed, but Depends handles it
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera una vista previa del archivo.
    - Si es PDF: Retorna el PDF directo.
    - Si es DOCX: Convierte a PDF en el servidor (usando docx2pdf) y retorna el PDF.
    - Otros: Retorna el binario tal cual (imagen, etc).
    """
    result = await db.execute(select(Archivo).where(Archivo.archivo_id == file_id))
    archivo = result.scalar_one_or_none()
    
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    storage = get_storage_service()
    
    try:
        # 1. Descargar contenido crudo
        file_content = storage.download_file(archivo.url)
        
        # Base64 fix (same as download)
        if file_content.startswith(b"data:"):
             header, _, data_part = file_content.partition(b",")
             if data_part: file_content = base64.b64decode(data_part)
        elif file_content.startswith(b"UEsDB"):
             try:
                 decoded = base64.b64decode(file_content)
                 if decoded.startswith(b"PK"): file_content = decoded
             except: pass

        # 2. Determinar tipo
        is_word = archivo.nombre.lower().endswith((".docx", ".doc"))
        is_pdf = archivo.nombre.lower().endswith(".pdf")
        
        from fastapi.responses import StreamingResponse
        import io
        from core.utils.document_converter import convert_word_to_pdf
        
        if is_word:
            logger.info(f"Converting Word document {file_id} to PDF for preview...")
            pdf_content = convert_word_to_pdf(file_content, archivo.nombre)
            
            if pdf_content:
                return StreamingResponse(
                    io.BytesIO(pdf_content),
                    media_type="application/pdf",
                    headers={"Content-Disposition": "inline"}
                )
            else:
                logger.warning("Preview validation failed (conversion returned None), returning original.")
                
        # If PDF or other, return as is inline
        media_type = "application/pdf" if is_pdf else "application/octet-stream"
        return StreamingResponse(
            io.BytesIO(file_content), 
            media_type=media_type,
            headers={"Content-Disposition": "inline"}
        )

    except Exception as e:
        logger.error(f"Preview failed: {e}")
        raise HTTPException(status_code=500, detail="Error generando vista previa")

@router.get("/files/{file_id}/url")
async def get_file_url(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene una URL temporal para ver/descargar el archivo.
    Ideal para visualización directa en navegador (GCS Signed URL).
    Retorna { "url": "..." } o { "url": null } si es local.
    """
    result = await db.execute(select(Archivo).where(Archivo.archivo_id == file_id))
    archivo = result.scalar_one_or_none()
    
    if not archivo or not archivo.url:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    storage = get_storage_service()
    signed_url = storage.get_signed_url(archivo.url)
    
    return {"url": signed_url}

@router.get("/folders", response_model=List[CarpetaSchema])
async def list_folders(
    parent_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista las carpetas.
    - Si parent_id es None: Retorna las carpetas raíz del usuario.
    - Si parent_id existe: Retorna las subcarpetas de esa carpeta.
    """
    if parent_id is None:
        # Retornamos las carpetas raíz del usuario
        query = (
            select(Carpeta)
            .join(UsuarioCarpeta)
            .where(
                UsuarioCarpeta.usuario_id == current_user.id,
                Carpeta.habilitado == True
            )
        )
    else:
        # Obtener subcarpetas normales
        # Pero aquí ENRIQUECEMOS la consulta para traer datos del RFP si es una carpeta TVT
        # y contar versiones.
        
        from models.rfp import RFPSubmission
        from sqlalchemy import func, case
        from sqlalchemy.orm import aliased
        
        CarpetaHija = aliased(Carpeta) # Proposals
        CarpetaNieto = aliased(Carpeta) # Versiones
        
        # Subquery para contar versiones
        # Logic: Count Carpetas (Nieto) where Parent (Hija) is 'proposals' and Parent's Parent is current row (TVT)
        version_count_subquery = (
            select(func.count(CarpetaNieto.carpeta_id))
            .join(CarpetaHija, CarpetaHija.carpeta_id == CarpetaNieto.parent_id)
            .where(
                CarpetaHija.parent_id == Carpeta.carpeta_id,
                CarpetaHija.nombre == 'proposals',
                CarpetaNieto.habilitado == True
            )
            .scalar_subquery()
        )
        
        query = (
            select(
                Carpeta,
                RFPSubmission.client_name,
                version_count_subquery.label("version_count")
            )
            .outerjoin(RFPSubmission, Carpeta.nombre == RFPSubmission.tvt) # Join con RFP por TVT
            .where(
                Carpeta.parent_id == parent_id,
                Carpeta.habilitado == True
            )
        )
    
    result = await db.execute(query)
    
    # Procesar resultados dependiendo de si la query devolvió tuplas (enriquecida) o solo objetos
    folders_data = []
    
    # Check logic: if parent_id passed, we expect tuples (Carpeta, client_name, count)
    # If parent_id is None (root listing), we expect scalars (Carpeta)
    
    if parent_id is not None:
        for row in result.all():
            folder = row[0]
            client_name = row[1]
            v_count = row[2]
            
            # Map attributes to schema manually or setattr on model instance (temporary)
            folder.client_name = client_name
            folder.version_count = v_count or 0
            folders_data.append(folder)
        return folders_data
    else:
        return result.scalars().all()


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Elimina una carpeta (lógica soft-delete o física si está vacía).
    Por ahora hacemos soft-delete.
    """
    result = await db.execute(select(Carpeta).where(Carpeta.carpeta_id == folder_id))
    folder = result.scalar_one_or_none()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")
        
    folder.habilitado = False
    await db.commit()
    return {"message": "Carpeta eliminada"}


@router.get("/folders/{folder_id}", response_model=FolderContentSchema)
async def get_folder_content(
    folder_id: uuid.UUID,
    search: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    min_proposals: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene el contenido de una carpeta (info, subcarpetas, archivos).
    Permite filtrar subcarpetas por:
    - search: Nombre de carpeta o Cliente (TVT)
    - start_date, end_date: Rango de fecha de creación
    - min_proposals: Cantidad mínima de versiones/propuestas (solo para carpetas GO)
    """
    # 1. Obtener la carpeta principal
    result = await db.execute(select(Carpeta).where(Carpeta.carpeta_id == folder_id))
    folder = result.scalar_one_or_none()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")

    # 2. Obtener subcarpetas
    from models.rfp import RFPSubmission
    from sqlalchemy import func, or_, and_
    from sqlalchemy.orm import aliased
    
    CarpetaHija = aliased(Carpeta) # Proposals
    CarpetaNieto = aliased(Carpeta) # Versiones
    
    version_count_subquery = (
        select(func.count(CarpetaNieto.carpeta_id))
        .join(CarpetaHija, CarpetaHija.carpeta_id == CarpetaNieto.parent_id)
        .where(
            CarpetaHija.parent_id == Carpeta.carpeta_id,
            CarpetaHija.nombre == 'proposals',
            CarpetaNieto.habilitado == True
        )
        .scalar_subquery()
    )
    
    sub_query = (
        select(
            Carpeta,
            RFPSubmission.client_name,
            version_count_subquery.label("version_count")
        )
        .outerjoin(RFPSubmission, Carpeta.nombre == RFPSubmission.tvt)
        .where(
            Carpeta.parent_id == folder_id,
            Carpeta.habilitado == True
        )
    )
    
    # --- FILTROS ---
    if search:
        search_filter = f"%{search}%"
        sub_query = sub_query.where(
            or_(
                Carpeta.nombre.ilike(search_filter),
                RFPSubmission.client_name.ilike(search_filter)
            )
        )
    
    if start_date:
        sub_query = sub_query.where(Carpeta.creado >= start_date)
        
    if end_date:
        # Ajustar end_date para incluir todo el dia (si viene solo fecha, o asumir usuario envia timestamp)
        # Assuming frontend sends simplified date, we might want to ensure coverage, but usually exact match logic applies
        sub_query = sub_query.where(Carpeta.creado <= end_date)
    
    
    sub_result = await db.execute(sub_query)
    
    subfolders_data = []
    for row in sub_result.all():
        f = row[0]
        # Asegurarse de que f es una instancia válida y no hay conflictos de sesión
        f.client_name = row[1]
        f.version_count = row[2] or 0
        
        # Filtro post-query para min_proposals (ya que version_count es subquery escalar)
        if min_proposals is not None:
             if f.version_count < min_proposals:
                 continue

        subfolders_data.append(f)
    
    subfolders = subfolders_data
    
    # 3. Obtener archivos
    files_result = await db.execute(
        select(Archivo).where(
            Archivo.carpeta_id == folder_id,
            Archivo.habilitado == True
        )
    )
    files = files_result.scalars().all()
    
    # 4. Construir breadcrumbs
    # Logic: Recursive hierarchy up to root
    # For efficiency we grab parent chain.
    # Since we don't have CTE recursive in this snippet easily without complex setup,
    # let's do a simple iterative lookup (depth is usually small ~3-4 levels: Version -> Proposal -> TVT -> GO -> Root)
    
    path = []
    current = folder
    path.insert(0, current) # Add self
    
    # Maximum depth safety
    for _ in range(5):
        if not current.parent_id:
            break
            
        parent_res = await db.execute(select(Carpeta).where(Carpeta.carpeta_id == current.parent_id))
        parent = parent_res.scalar_one_or_none()
        
        if parent:
            path.insert(0, parent)
            current = parent
        else:
            break
    
    return {
        "carpeta": folder,
        "subcarpetas": subfolders,
        "archivos": files,
        "path": path 
    }
