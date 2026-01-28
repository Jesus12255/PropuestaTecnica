from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

class ArchivoSchema(BaseModel):
    archivo_id: UUID
    carpeta_id: UUID | None = None
    nombre: str
    url: Optional[str] = None
    creado: Optional[datetime] = None
    habilitado: bool
    file_type: str | None = None
    file_size_bytes: int | None = None

    class Config:
        from_attributes = True

class CarpetaSchema(BaseModel):
    carpeta_id: UUID
    nombre: str
    codigo: Optional[str] = None
    prefijo: Optional[str] = None
    url: Optional[str] = None
    creado: Optional[datetime] = None
    habilitado: bool
    parent_id: Optional[UUID] = None
    client_name: Optional[str] = None  # Para TVTs
    version_count: Optional[int] = 0   # Para TVTs
    # To avoid recursion issues with children, handled in detail view

    class Config:
        from_attributes = True

class CarpetaDetailSchema(CarpetaSchema):
    archivos: List[ArchivoSchema] = []
    # subcarpetas handled manually? SQLAlchemy relationship might need recursion handling
    # For now, simplistic approach: children not included in detail unless requested?
    # Or just returning flat list of contents for a folder view.

class FolderContentSchema(BaseModel):
    carpeta: CarpetaSchema
    subcarpetas: List[CarpetaSchema]
    archivos: List[ArchivoSchema]
    path: List[CarpetaSchema] # Breadcrumbs
