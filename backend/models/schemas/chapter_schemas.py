"""
Schemas para Capítulos.
"""
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class ChapterBase(BaseModel):
    name: str
    description: Optional[str] = None
    filename: str
    location: Optional[str] = None
    is_active: bool = True

class ChapterCreate(ChapterBase):
    pass

class Chapter(ChapterBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChapterRecommendationRequest(BaseModel):
    rfp_id: UUID

class ChapterRecommendation(BaseModel):
    chapter_id: UUID
    score: float
    reason: str
