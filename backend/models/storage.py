

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Integer
import uuid
from datetime import datetime
import sqlalchemy
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base

class Carpeta(Base):
    """Modelo para carpetas de almacenamiento."""
    
    __tablename__ = "carpeta"
    
    carpeta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    nombre: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    creado: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=True
    )
    habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Jerarquía
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carpeta.carpeta_id"),
        nullable=True
    )
    
    # Relaciones
    children: Mapped[list["Carpeta"]] = relationship("Carpeta", backref=sqlalchemy.orm.backref("parent", remote_side=[carpeta_id]))
    archivos: Mapped[list["Archivo"]] = relationship(
        "Archivo", 
        back_populates="carpeta",
        cascade="all, delete-orphan"
    )
    usuario_carpetas: Mapped[list["UsuarioCarpeta"]] = relationship(
        "UsuarioCarpeta",
        back_populates="carpeta",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Carpeta {self.nombre}>"


class Archivo(Base):
    """Modelo para archivos dentro de carpetas."""
    
    __tablename__ = "archivo"
    
    archivo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    carpeta_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("carpeta.carpeta_id"),
        nullable=True
    )
    
    nombre: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    creado: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=True
    )
    habilitado: Mapped[bool] = mapped_column(Boolean, default=True)

    # Campos adicionales solicitados
    rfp_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rfp_submissions.id"),
        nullable=True
    )
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    processed_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    # Relaciones
    carpeta: Mapped["Carpeta"] = relationship("Carpeta", back_populates="archivos")
    # rfp relationship to be added if needed, or backref from RFPSubmission
    
    def __repr__(self) -> str:
        return f"<Archivo {self.nombre}>"


class UsuarioCarpeta(Base):
    """Tabla intermedia para asociar usuarios, carpetas y RFPs."""
    
    __tablename__ = "usuario_carpeta"
    
    usuario_carpeta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"),
        nullable=False
    )
    
    carpeta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("carpeta.carpeta_id"),
        nullable=False
    )
    
    rfp_submissions_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("rfp_submissions.id"),
        nullable=True
    )
    
    creado: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=True
    )
    habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relaciones
    usuario: Mapped["User"] = relationship("User") # Assuming User model is available in registry
    carpeta: Mapped["Carpeta"] = relationship("Carpeta", back_populates="usuario_carpetas")
    rfp_submission: Mapped["RFPSubmission"] = relationship("RFPSubmission")

    def __repr__(self) -> str:
        return f"<UsuarioCarpeta User:{self.usuario_id} Folder:{self.carpeta_id}>"
