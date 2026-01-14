"""
Pydantic schemas para RFP Analyzer.
"""
from datetime import datetime, date
from typing import Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


# ============ ENUMS ============

class RFPStatusEnum(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    ANALYZED = "analyzed"
    GO = "go"
    NO_GO = "no_go"
    ERROR = "error"


class RFPCategoryEnum(str, Enum):
    MANTENCION_APLICACIONES = "mantencion_aplicaciones"
    DESARROLLO_SOFTWARE = "desarrollo_software"
    ANALITICA = "analitica"
    IA_CHATBOT = "ia_chatbot"
    IA_DOCUMENTOS = "ia_documentos"
    IA_VIDEO = "ia_video"
    OTRO = "otro"


class RecommendationEnum(str, Enum):
    STRONG_GO = "strong_go"
    GO = "go"
    CONDITIONAL_GO = "conditional_go"
    NO_GO = "no_go"
    STRONG_NO_GO = "strong_no_go"


class QuestionCategoryEnum(str, Enum):
    SCOPE = "scope"
    TECHNICAL = "technical"
    COMMERCIAL = "commercial"
    TIMELINE = "timeline"
    TEAM = "team"
    SLA = "sla"
    LEGAL = "legal"


class QuestionPriorityEnum(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ============ RFP SCHEMAS ============

class RecommendedISO(BaseModel):
    """Recommended ISO certification."""
    id: str
    level: str  # high, medium, low

class RFPBase(BaseModel):
    """Base schema for RFP."""
    file_name: str


class RFPCreate(RFPBase):
    """Schema for creating an RFP (upload)."""
    pass


class RFPDecision(BaseModel):
    """Schema for GO/NO GO decision."""
    decision: str = Field(..., pattern="^(go|no_go)$", description="Decision: 'go' or 'no_go'")
    reason: str | None = Field(None, description="Reason for the decision")


class RFPQuestion(BaseModel):
    """Schema for a question."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    question: str
    category: str | None = None
    priority: str | None = None
    context: str | None = None
    why_important: str | None = None
    is_answered: bool = False
    answer: str | None = None
    answered_at: datetime | None = None
    created_at: datetime


class RFPSummary(BaseModel):
    """Schema for RFP in list/table view."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    file_name: str
    status: RFPStatusEnum
    client_name: str | None = None
    country: str | None = None
    category: str | None = None
    summary: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    currency: str = "USD"
    proposal_deadline: date | None = None
    recommendation: str | None = None
    decision: str | None = None
    created_at: datetime
    analyzed_at: datetime | None = None


class RFPDetail(RFPSummary):
    """Schema for RFP detail view with all extracted data."""
    model_config = ConfigDict(from_attributes=True)
    
    file_gcs_path: str
    file_size_bytes: int | None = None
    extracted_data: dict[str, Any] | None = None
    questions_deadline: date | None = None
    project_duration: str | None = None
    confidence_score: int | None = None
    recommended_isos: list[RecommendedISO] | None = None
    decision_reason: str | None = None
    decided_at: datetime | None = None
    updated_at: datetime
    questions: list[RFPQuestion] = []


# ============ DASHBOARD SCHEMAS ============

class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_rfps: int = 0
    go_count: int = 0
    no_go_count: int = 0
    pending_count: int = 0
    analyzing_count: int = 0
    go_rate: float = 0.0  # Percentage


class RFPListResponse(BaseModel):
    """Schema for paginated RFP list."""
    items: list[RFPSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============ ANALYSIS SCHEMAS ============

class BudgetInfo(BaseModel):
    """Budget information extracted from RFP."""
    amount_min: float | None = None
    amount_max: float | None = None
    currency: str = "USD"
    notes: str | None = None


class TeamProposal(BaseModel):
    """Team proposal from client."""
    suggested: bool = False
    details: str | None = None


class ExperienceRequired(BaseModel):
    """Experience requirements."""
    required: bool = False
    details: str | None = None
    is_mandatory: bool = False


class SLAItem(BaseModel):
    """Single SLA item."""
    description: str
    metric: str | None = None
    is_aggressive: bool = False


class PenaltyItem(BaseModel):
    """Single penalty item."""
    description: str
    amount: str | None = None
    is_high: bool = False


class RiskItem(BaseModel):
    """Single risk item."""
    category: str
    description: str
    severity: str = "medium"  # low, medium, high, critical





class ExtractedRFPData(BaseModel):
    """Complete extracted data from RFP analysis."""
    # Basic info
    client_name: str | None = None
    country: str | None = None
    summary: str | None = None
    category: str | None = None
    
    # Commercial
    budget: BudgetInfo | None = None
    project_duration: str | None = None
    questions_deadline: str | None = None  # ISO date string
    proposal_deadline: str | None = None   # ISO date string
    
    # Technical
    tech_stack: list[str] = []
    team_proposal: TeamProposal | None = None
    
    # Requirements
    experience_required: ExperienceRequired | None = None
    
    # SLA and Penalties
    sla: list[SLAItem] = []
    penalties: list[PenaltyItem] = []
    
    # Analysis
    risks: list[RiskItem] = []
    recommendation: str | None = None
    recommendation_reasons: list[str] = []
    confidence_score: int | None = None
    
    # Certifications
    recommended_isos: list[RecommendedISO] = []


# ============ UPLOAD RESPONSE ============

class UploadResponse(BaseModel):
    """Response after uploading an RFP."""
    id: UUID
    file_name: str
    status: RFPStatusEnum
    message: str = "RFP uploaded successfully. Analysis in progress."


# ============ TEAM & COST ESTIMATION SCHEMAS ============

class ScenarioEnum(str, Enum):
    """Los 4 escenarios de estimacion."""
    A = "A"  # Personal + Presupuesto -> Validar viabilidad
    B = "B"  # Sin Personal + Presupuesto -> IA sugiere equipo
    C = "C"  # Personal + Sin Presupuesto -> Estimar presupuesto
    D = "D"  # Sin Personal + Sin Presupuesto -> IA sugiere todo


class SeniorityEnum(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"


class DedicationEnum(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"


class ViabilityEnum(str, Enum):
    VIABLE = "viable"
    UNDER_BUDGET = "under_budget"
    OVER_BUDGET = "over_budget"
    NEEDS_REVIEW = "needs_review"


class MarketRate(BaseModel):
    """Tarifa de mercado obtenida via grounding."""
    min: float
    max: float
    average: float
    currency: str = "USD"
    period: str = "monthly"
    source: str | None = None  # Ej: "Glassdoor, LinkedIn Salary"


class RoleEstimation(BaseModel):
    """Estimacion de un rol individual."""
    role_id: str
    title: str
    quantity: int = 1
    seniority: SeniorityEnum = SeniorityEnum.SENIOR
    required_skills: list[str] = []
    required_certifications: list[str] = []
    dedication: DedicationEnum = DedicationEnum.FULL_TIME
    duration_months: int | None = None
    market_rate: MarketRate | None = None
    subtotal_monthly: float | None = None
    justification: str | None = None


class TeamEstimation(BaseModel):
    """Estimacion completa del equipo."""
    source: str  # "client_specified" o "ai_estimated"
    scenario: ScenarioEnum
    confidence: float = 0.0  # 0-1
    roles: list[RoleEstimation] = []
    total_headcount: int = 0
    rationale: str | None = None


class CostBreakdownItem(BaseModel):
    """Item de desglose de costos."""
    role: str
    quantity: int
    monthly_rate: float
    subtotal: float


class ViabilityAnalysis(BaseModel):
    """Analisis de viabilidad presupuestaria."""
    client_budget: float | None = None
    required_budget: float
    gap: float = 0.0
    gap_percent: float = 0.0
    is_viable: bool = True
    assessment: ViabilityEnum = ViabilityEnum.VIABLE
    recommendations: list[str] = []


class CostEstimation(BaseModel):
    """Estimacion completa de costos."""
    scenario: ScenarioEnum
    scenario_description: str | None = None
    
    # Costo del equipo
    monthly_base: float = 0.0
    currency: str = "USD"
    source: str = "grounding"  # o "estimated"
    breakdown: list[CostBreakdownItem] = []
    
    # Margen (solo para escenarios C y D)
    margin_percent: float = 20.0
    margin_amount: float = 0.0
    
    # Presupuesto sugerido (solo para escenarios C y D)
    suggested_monthly: float | None = None
    duration_months: int | None = None
    suggested_total: float | None = None
    
    # Analisis de viabilidad (solo para escenarios A y B)
    viability: ViabilityAnalysis | None = None


class MCPCandidate(BaseModel):
    """Candidato retornado por MCP."""
    matricula: str
    nombre: str
    email: str
    cargo: str
    pais: str | None = None
    score: float = 0.0
    match_principal: str | None = None
    certificaciones: list[dict] = []
    skills: list[dict] = []
    lider: dict | None = None


class MCPRoleResult(BaseModel):
    """Resultado de MCP para un rol."""
    rol_id: str
    descripcion: str
    candidatos: list[MCPCandidate] = []
    total: int = 0


class SuggestedTeam(BaseModel):
    """Equipo sugerido con candidatos reales de MCP."""
    generated_at: str | None = None
    mcp_available: bool = True
    resultados: dict[str, MCPRoleResult] = {}
    total_roles: int = 0
    total_candidatos: int = 0
    coverage_percent: float = 0.0  # % de roles con al menos 1 candidato


class TeamSuggestionRequest(BaseModel):
    """Request para sugerir equipo."""
    force_refresh: bool = False  # Forzar nueva busqueda en MCP


class TeamSuggestionResponse(BaseModel):
    """Response con estimacion de equipo, costos y candidatos."""
    rfp_id: UUID
    scenario: ScenarioEnum
    team_estimation: TeamEstimation
    cost_estimation: CostEstimation
    suggested_team: SuggestedTeam | None = None
    message: str | None = None

