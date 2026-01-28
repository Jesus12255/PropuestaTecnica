"""
System-wide chat endpoint.
Provides chat functionality with knowledge of all RFPs and system guidance.
"""
import json
import logging
import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.gcp import get_gemini_client
from models.rfp import RFPSubmission
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatHistoryItem(BaseModel):
    """A message in conversation history."""
    role: Literal["user", "assistant"]
    content: str


class SystemChatRequest(BaseModel):
    """Request for system-wide chat."""
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatHistoryItem] = Field(default=[], max_length=20)


class SystemChatResponse(BaseModel):
    """Response from system chat."""
    response: str
    mode: str = "system"


# System guidance text
SYSTEM_GUIDANCE = """
## Guía del Sistema TIVIT Proposals

### ¿Qué puedo hacer aquí?
1. **Subir RFPs**: Arrastra un PDF/DOCX y el sistema lo analiza automáticamente
2. **Ver análisis**: Cada RFP muestra riesgos, multas, SLAs, recomendación GO/NO-GO
3. **Tomar decisiones**: Marca como GO (generar propuesta) o NO-GO (rechazar)
4. **Buscar equipo**: El sistema sugiere candidatos de TIVIT para cada rol
5. **Generar propuestas**: Combina certificaciones, experiencias y capítulos

### Secciones principales:
- **Dashboard**: Vista general de todos los RFPs
- **RFPs Pendientes**: Los que esperan decisión
- **Certificaciones**: Certificados de la empresa para propuestas
- **Experiencias**: Proyectos anteriores como referencia
- **Capítulos**: Secciones reutilizables para propuestas
"""


@router.post("/system", response_model=SystemChatResponse)
async def system_chat(
    request: SystemChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chat with system-wide knowledge.
    
    Knows about all RFPs, provides system guidance, and answers general questions.
    Uses optimized SQL (no heavy JSON) and TOON format for token efficiency.
    """
    # Optimized SQL: Only fetch lightweight columns (no extracted_data JSON)
    result = await db.execute(
        select(
            RFPSubmission.id,
            RFPSubmission.client_name,
            RFPSubmission.file_name,
            RFPSubmission.status,
            RFPSubmission.recommendation,
            RFPSubmission.budget_max,
            RFPSubmission.currency,
            RFPSubmission.proposal_deadline,
            RFPSubmission.category,
        )
        .order_by(RFPSubmission.created_at.desc())
        .limit(50)
    )
    rfps = result.all()
    
    # Format budget in compact form (TOON-style)
    def compact_budget(amount, currency):
        if not amount:
            return "-"
        if amount >= 1_000_000:
            return f"{currency or '$'}{amount/1_000_000:.1f}M"
        if amount >= 1_000:
            return f"{currency or '$'}{amount/1_000:.0f}K"
        return f"{currency or '$'}{amount}"
    
    # Build TOON-format RFP list (Token-Optimized Object Notation)
    # Format: status|client|budget|rec|deadline
    toon_header = "Estado|Cliente|Presupuesto|Rec|Deadline"
    toon_rows = [toon_header]
    
    for rfp in rfps:
        status_short = {
            'pending': 'PEND', 'analyzing': 'ANLZ', 'analyzed': 'DONE',
            'go': 'GO', 'no_go': 'NOGO', 'error': 'ERR'
        }.get(rfp.status, rfp.status[:4].upper())
        
        client = (rfp.client_name or rfp.file_name or "?")[:20]
        budget = compact_budget(rfp.budget_max, rfp.currency)
        rec = (rfp.recommendation or "-")[:6]
        deadline = str(rfp.proposal_deadline)[:10] if rfp.proposal_deadline else "-"
        
        toon_rows.append(f"{status_short}|{client}|{budget}|{rec}|{deadline}")
    
    rfp_context = "\n".join(toon_rows)
    
    # Stats (calculated from lightweight data)
    total_rfps = len(rfps)
    go_count = sum(1 for r in rfps if r.status == 'go')
    no_go_count = sum(1 for r in rfps if r.status == 'no_go')
    pending_count = sum(1 for r in rfps if r.status in ['pending', 'analyzing', 'analyzed'])
    
    # Build system prompt
    system_prompt = f"""
Eres el asistente del sistema TIVIT Proposals.
Tu rol es ayudar a los usuarios a navegar el sistema y responder preguntas sobre los RFPs.

{SYSTEM_GUIDANCE}

## Estado actual del sistema:
- Total RFPs: {total_rfps}
- Aprobados (GO): {go_count}
- Rechazados (NO-GO): {no_go_count}
- Pendientes: {pending_count}

## Lista de RFPs (formato TOON: Estado|Cliente|Presupuesto|Rec|Deadline):
Leyenda: PEND=Pendiente, ANLZ=Analizando, DONE=Analizado, GO=Aprobado, NOGO=Rechazado
{rfp_context}

## Reglas:
1. Responde en español, de forma concisa y amigable
2. Si preguntan por un RFP específico, busca por nombre de cliente en la tabla
3. Si preguntan cómo hacer algo, guíalos paso a paso
4. Si no tienes información suficiente, sugiéreles revisar la sección correspondiente
"""
    
    # Build conversation with history
    conversation_parts = [system_prompt]
    
    if request.history:
        conversation_parts.append("\n## Conversación previa:")
        for msg in request.history[-20:]:
            role_label = "Usuario" if msg.role == "user" else "Asistente"
            conversation_parts.append(f"{role_label}: {msg.content}")
    
    conversation_parts.append(f"\nUsuario: {request.message}")
    conversation_parts.append("\nAsistente:")
    
    full_prompt = "\n".join(conversation_parts)
    
    # Call Gemini Flash
    try:
        gemini = get_gemini_client()
        response = await asyncio.to_thread(
            gemini.client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=full_prompt,
            config={
                "temperature": 0.5,  # Slightly more creative for guidance
                "max_output_tokens": 2048,
            },
        )
        
        response_text = response.text if response.text else "No pude generar una respuesta."
        
        return SystemChatResponse(
            response=response_text,
            mode="system",
        )
        
    except Exception as e:
        logger.error(f"Error in system chat: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar la consulta: {str(e)}"
        )
