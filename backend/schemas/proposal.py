from pydantic import BaseModel
from uuid import UUID

class ProposalGenerationRequest(BaseModel):
    rfp_id: UUID
    certification_ids: list[UUID] = []
