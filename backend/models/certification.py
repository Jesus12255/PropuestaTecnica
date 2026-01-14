"""
Modelo de Certificaciones.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base

class Certification(Base):
    """Modelo para catálogo de certificaciones."""
    
    __tablename__ = "certifications"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Nombre del archivo .docx en templates/certs/ (ej: iso9001.docx)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<Certification {self.name}>"
