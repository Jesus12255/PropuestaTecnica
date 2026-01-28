"""API routes module."""
from .rfp import router as rfp_router
from .dashboard import router as dashboard_router
from .auth import router as auth_router
from .proposal import router as proposal_router
from .certifications import router as certifications_router
from .experiences import router as experiences_router
from .chapters import router as chapters_router
from .chat import router as chat_router
from .storage import router as storage_router

__all__ = ["rfp_router", "dashboard_router", "auth_router", "proposal_router", "certifications_router", "experiences_router", "chapters_router", "chat_router", "storage_router"]
