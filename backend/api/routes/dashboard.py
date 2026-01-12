"""
Endpoints para el Dashboard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from models.rfp import RFPSubmission, RFPStatus
from models.schemas import DashboardStats, RFPSummary
from models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene estadísticas del dashboard.
    
    - Total de RFPs
    - Conteo por status (GO, NO GO, Pending, Analyzing)
    - Tasa de GO
    """
    # Query para contar por status
    query = select(
        func.count(RFPSubmission.id).label("total"),
        func.sum(case((RFPSubmission.status == RFPStatus.GO.value, 1), else_=0)).label("go_count"),
        func.sum(case((RFPSubmission.status == RFPStatus.NO_GO.value, 1), else_=0)).label("no_go_count"),
        func.sum(case((RFPSubmission.status == RFPStatus.PENDING.value, 1), else_=0)).label("pending_count"),
        func.sum(case((RFPSubmission.status == RFPStatus.ANALYZING.value, 1), else_=0)).label("analyzing_count"),
    )
    
    result = await db.execute(query)
    row = result.one()
    
    total = row.total or 0
    go_count = row.go_count or 0
    no_go_count = row.no_go_count or 0
    
    # Calcular tasa de GO (solo sobre decisiones tomadas)
    decisions = go_count + no_go_count
    go_rate = (go_count / decisions * 100) if decisions > 0 else 0.0
    
    return DashboardStats(
        total_rfps=total,
        go_count=go_count,
        no_go_count=no_go_count,
        pending_count=row.pending_count or 0,
        analyzing_count=row.analyzing_count or 0,
        go_rate=round(go_rate, 1),
    )


@router.get("/recent", response_model=list[RFPSummary])
async def get_recent_rfps(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene los RFPs más recientes.
    """
    query = (
        select(RFPSubmission)
        .order_by(RFPSubmission.created_at.desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    rfps = result.scalars().all()
    
    return [RFPSummary.model_validate(rfp) for rfp in rfps]


@router.get("/pending", response_model=list[RFPSummary])
async def get_pending_rfps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene los RFPs pendientes de decisión (analizados pero sin GO/NO GO).
    """
    query = (
        select(RFPSubmission)
        .where(RFPSubmission.status == RFPStatus.ANALYZED.value)
        .order_by(RFPSubmission.proposal_deadline.asc().nullslast())
    )
    
    result = await db.execute(query)
    rfps = result.scalars().all()
    
    return [RFPSummary.model_validate(rfp) for rfp in rfps]


@router.get("/by-category")
async def get_rfps_by_category(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene conteo de RFPs agrupados por categoría.
    """
    query = (
        select(
            RFPSubmission.category,
            func.count(RFPSubmission.id).label("count")
        )
        .where(RFPSubmission.category.isnot(None))
        .group_by(RFPSubmission.category)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [{"category": row.category, "count": row.count} for row in rows]


@router.get("/by-status")
async def get_rfps_by_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene conteo de RFPs agrupados por status.
    """
    query = (
        select(
            RFPSubmission.status,
            func.count(RFPSubmission.id).label("count")
        )
        .group_by(RFPSubmission.status)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [{"status": row.status, "count": row.count} for row in rows]


@router.get("/api-consumption")
async def get_api_consumption(
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene el resumen de consumo de la API de Gemini.
    
    Muestra:
    - Total de requests
    - Tokens consumidos (input, output, thinking)
    - Tasa de éxito
    - Últimos 10 logs
    """
    from core.gcp.gemini_client import get_consumption_summary
    return get_consumption_summary()


@router.get("/storage-info")
async def get_storage_info(
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene información del estado del almacenamiento.
    
    Muestra:
    - Storage primario activo (GCS o local)
    - Si GCS está disponible
    - Bucket de GCS (si aplica)
    - Estadísticas de almacenamiento local
    """
    from core.storage import get_storage_service
    storage = get_storage_service()
    return storage.get_storage_info()

