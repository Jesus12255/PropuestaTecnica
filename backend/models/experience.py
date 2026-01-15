import uuid
from datetime import datetime, date
from sqlalchemy import String, Text, Date, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base

class Experience(Base):
    """Modelo para almacenar experiencias previas (casos de éxito)."""
    __tablename__ = "experiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    descripcion_servicio: Mapped[str] = mapped_column(Text, nullable=False)
    propietario_servicio: Mapped[str] = mapped_column(String, nullable=False)
    ubicacion: Mapped[str] = mapped_column(String, nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=True)
    monto_final: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Experience {self.propietario_servicio} - {self.descripcion_servicio[:30]}>"
