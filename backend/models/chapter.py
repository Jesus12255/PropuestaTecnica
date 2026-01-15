"""
Modelo de Capítulos de Propuestas.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base

class Chapter(Base):
    """Modelo para catálogo de capítulos de propuestas."""
    
    __tablename__ = "chapters"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    
    location: Mapped[str | None] = mapped_column(String(512), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<Chapter {self.name}>"
