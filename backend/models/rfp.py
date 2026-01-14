"""
Modelos SQLAlchemy para RFP Analyzer.
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    String, Text, Integer, Boolean, DateTime, Date, 
    Numeric, ForeignKey, Enum, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from core.database import Base


class RFPStatus(str, PyEnum):
    """Estados posibles de un RFP."""
    PENDING = "pending"           # Recién subido, esperando análisis
    ANALYZING = "analyzing"       # Gemini analizando
    ANALYZED = "analyzed"         # Análisis completado, esperando decisión
    GO = "go"                     # Decisión: continuar
    NO_GO = "no_go"               # Decisión: no continuar
    ERROR = "error"               # Error durante el análisis


class RFPCategory(str, PyEnum):
    """Categorías de proyectos."""
    MANTENCION_APLICACIONES = "mantencion_aplicaciones"
    DESARROLLO_SOFTWARE = "desarrollo_software"
    ANALITICA = "analitica"
    IA_CHATBOT = "ia_chatbot"
    IA_DOCUMENTOS = "ia_documentos"
    IA_VIDEO = "ia_video"
    OTRO = "otro"


class Recommendation(str, PyEnum):
    """Recomendaciones de la IA."""
    STRONG_GO = "strong_go"
    GO = "go"
    CONDITIONAL_GO = "conditional_go"
    NO_GO = "no_go"
    STRONG_NO_GO = "strong_no_go"


class QuestionCategory(str, PyEnum):
    """Categorías de preguntas."""
    SCOPE = "scope"
    TECHNICAL = "technical"
    COMMERCIAL = "commercial"
    TIMELINE = "timeline"
    TEAM = "team"
    SLA = "sla"
    LEGAL = "legal"


class QuestionPriority(str, PyEnum):
    """Prioridad de preguntas."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RFPSubmission(Base):
    """Modelo para submissions de RFP."""
    
    __tablename__ = "rfp_submissions"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    # Archivo
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_gcs_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(
        String(20), 
        default=RFPStatus.PENDING.value,
        nullable=False
    )
    
    # Datos extraídos (JSONB para flexibilidad)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    # Campos indexados para búsqueda/filtros
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_acronym: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Presupuesto
    budget_min: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(20), nullable=True, default="USD")
    
    # Fechas
    proposal_deadline: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    questions_deadline: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    project_duration: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Métricas de análisis
    confidence_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recommended_isos: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    
    # Decisión del BDM
    decision: Mapped[str | None] = mapped_column(String(10), nullable=True)  # go, no_go
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relaciones
    questions: Mapped[list["RFPQuestion"]] = relationship(
        "RFPQuestion", 
        back_populates="rfp",
        cascade="all, delete-orphan"
    )
    
    # Índices
    __table_args__ = (
        Index("idx_rfp_status", "status"),
        Index("idx_rfp_created", "created_at"),
        Index("idx_rfp_client", "client_name"),
        Index("idx_rfp_category", "category"),
        Index("idx_rfp_deadline", "proposal_deadline"),
    )
    
    def __repr__(self) -> str:
        return f"<RFPSubmission {self.id} - {self.client_name}>"


class RFPQuestion(Base):
    """Modelo para preguntas generadas por la IA."""
    
    __tablename__ = "rfp_questions"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    # Foreign key
    rfp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("rfp_submissions.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Pregunta
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    why_important: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Respuesta (cuando el cliente responde)
    is_answered: Mapped[bool] = mapped_column(Boolean, default=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        nullable=False
    )
    
    # Relaciones
    rfp: Mapped["RFPSubmission"] = relationship("RFPSubmission", back_populates="questions")
    
    # Índices
    __table_args__ = (
        Index("idx_questions_rfp", "rfp_id"),
        Index("idx_questions_category", "category"),
    )
    
    def __repr__(self) -> str:
        return f"<RFPQuestion {self.id} - {self.category}>"
