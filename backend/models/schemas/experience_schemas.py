from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class ExperienceBase(BaseModel):
    descripcion_servicio: str
    propietario_servicio: str
    ubicacion: str
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    monto_final: Optional[float] = None

class ExperienceCreate(ExperienceBase):
    pass

class ExperienceUpdate(ExperienceBase):
    pass

class Experience(ExperienceBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class ExperienceRecommendation(BaseModel):
    experience_id: UUID
    score: float
    reason: str

class ExperienceRecommendationRequest(BaseModel):
    rfp_id: UUID
