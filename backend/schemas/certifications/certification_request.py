class CertificationRequest(BaseModel):
    rfp_id: UUID
    certification_ids: list[UUID] = []
