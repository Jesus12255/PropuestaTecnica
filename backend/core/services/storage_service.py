from models.storage import Archivo
from utils.constantes import Constantes
import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from models.storage import Carpeta, UsuarioCarpeta
from models.user import User

logger = logging.getLogger(__name__)



async def init_user_storage(db: AsyncSession, user: User):
  
    try:
        user_str_id = str(user.id)
        root_url = Constantes.UrlNames.STORAGE + Constantes.SLASH + user_str_id 
        root_folder = await create_folder(
            db=db,
            name=user.full_name,
            url=root_url
        )
        
        await _link_folder_to_user(db, user.id, root_folder.carpeta_id)
        
        await create_folder(
            db=db,
            name=Constantes.Storage.GO,
            url=root_url + Constantes.SLASH + Constantes.Storage.GO,
            parent_id=root_folder.carpeta_id
        )

        await create_folder(
            db=db,
            name=Constantes.Storage.NO_GO,
            url=root_url + Constantes.SLASH + Constantes.Storage.NO_GO,
            parent_id=root_folder.carpeta_id
        )
        
    except Exception as e:
        logger.error(f"Error initializing user storage: {e}")
        raise e





async def get_user_folder(db: AsyncSession, user_id: uuid.UUID, folder_name: str, parent_id: Optional[uuid.UUID] = None) -> Carpeta | None:
    """
    Obtiene una carpeta específica del usuario.
    
    Modo 1 (Optimizado Root/Hijos): Si NO se pasa parent_id, busca el Root o sus hijos directos (Go/No-Go)
    usando una sola consulta con JOIN.
    
    Modo 2 (Específico): Si se pasa parent_id, busca una carpeta hija exacta de ese padre.
    """
    
    if parent_id:
        # Modo Búsqueda Específica (Nivel Profundo)
        # Busca una carpeta que tenga este nombre Y pertenezca a este padre
        # También validamos que esté indirectamente ligada al usuario si es necesario, pero 
        # por eficiencia confiamos en la cadena de parent_id que viene de una fuente segura.
        query = select(Carpeta).where(
            Carpeta.nombre == folder_name,
            Carpeta.parent_id == parent_id
        )
    else:
        # Modo Original (Root y Nivel 2)
        query = (
            select(Carpeta)
            .join(
                UsuarioCarpeta, 
                or_(
                    UsuarioCarpeta.carpeta_id == Carpeta.carpeta_id,
                    UsuarioCarpeta.carpeta_id == Carpeta.parent_id
                )
            )
            .where(UsuarioCarpeta.usuario_id == user_id)
        )

        if folder_name == Constantes.Storage.ROOT:
            query = query.where(Carpeta.parent_id.is_(None))
        else:
            query = query.where(Carpeta.nombre == folder_name)

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_folder_children(db: AsyncSession, parent_id: uuid.UUID) -> list[Carpeta]:
    """
    Obtiene todas las carpetas hijas de un padre específico.
    """
    query = select(Carpeta).where(Carpeta.parent_id == parent_id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_folder(
    db: AsyncSession,
    name: str,
    parent_id: Optional[uuid.UUID] = None,
    url: Optional[str] = None,
) -> Carpeta:
    folder = Carpeta(
        nombre=name,
        url=url,
        parent_id=parent_id
    )

    db.add(folder)
    await db.flush() # Populate ID
    await db.refresh(folder)
    return folder

async def _link_folder_to_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    folder_id: uuid.UUID,
    rfp_id: Optional[uuid.UUID] = None
) -> UsuarioCarpeta:
    link = UsuarioCarpeta(
        usuario_id=user_id,
        carpeta_id=folder_id,
        rfp_submissions_id=rfp_id
    )
    db.add(link)
    return link

async def create_file(
    db: AsyncSession, 
    name: str, 
    url: Optional[str] = None,
    carpeta_id: Optional[uuid.UUID] = None,
    ) -> Archivo:

    file = Archivo(
        nombre=name,
        url=url,
        carpeta_id=carpeta_id
    )
    db.add(file)
    await db.flush()
    await db.refresh(file)
    return file


async def get_files_by_rfp_id(db: AsyncSession, rfp_id: uuid.UUID) -> list[Archivo]:
    query = select(Archivo).where(
        Archivo.rfp_id == rfp_id,
        Archivo.habilitado == Constantes.HABILITADO
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def change_folder(
    db: AsyncSession,
    carpeta_id: uuid.UUID,
    archivo_id: uuid.UUID,
) -> Archivo | None:
   
    query = select(Archivo).where(Archivo.archivo_id == archivo_id)
    result = await db.execute(query)
    file = result.scalar_one_or_none()
   
    if file:
        file.carpeta_id = carpeta_id
        await db.commit()
        await db.refresh(file)
        
    return file

