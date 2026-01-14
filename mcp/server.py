"""
MCP Talent Search Server v3.0
=============================
Sistema de busqueda semantica de talento con:
- Perfiles enriquecidos (todas las certs y skills por candidato)
- Integracion con Gemini 2.5 Flash para consultas naturales
- Endpoint /chat para lenguaje natural
- Deduplicacion inteligente de candidatos

Endpoints:
- GET  /health           - Health check
- GET  /docs             - Documentacion Swagger
- POST /search           - Busqueda simple
- POST /batch-search     - Busqueda por roles
- POST /chat             - Consulta en lenguaje natural (Gemini)
- GET  /countries        - Paises disponibles
- GET  /stats            - Estadisticas
- POST /reindex          - Reconstruir indices

Filtros automaticos:
- Certificaciones: Status=Verificado, Expirado=Nao
- RRHH: Status=Ativo
"""

import os
import json
import logging
import re
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from dotenv import load_dotenv

import pandas as pd
import lancedb
from sentence_transformers import SentenceTransformer
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field
import uvicorn
import httpx

# Cargar variables de entorno
load_dotenv()
# Tambien buscar en directorio padre
load_dotenv(Path(__file__).parent.parent / ".env")

# Configuracion de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURACION
# ============================================

BASE_DIR = Path(__file__).parent
CERT_FILE = BASE_DIR / "Capital_Intelectual.xlsx"
RRHH_FILE = BASE_DIR / "Census.xlsx"
LANCEDB_PATH = BASE_DIR / "lancedb_data"
TABLE_CERTS = "certificaciones"
TABLE_SKILLS = "skills"

# Modelo de embeddings multilingue
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

# Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-preview-05-20")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"


# ============================================
# MODELOS PYDANTIC
# ============================================

class Certificacion(BaseModel):
    """Certificacion de un colaborador."""
    nombre: str
    institucion: str
    fecha_emision: Optional[str] = None
    fecha_expiracion: Optional[str] = None


class Skill(BaseModel):
    """Skill tecnico de un colaborador."""
    nombre: str
    categoria: Optional[str] = None
    proficiencia: Optional[int] = None  # 1-5


class Lider(BaseModel):
    """Informacion del lider."""
    nombre: Optional[str] = None
    email: Optional[str] = None


class PerfilCompleto(BaseModel):
    """Perfil enriquecido de un candidato con todas sus certs y skills."""
    matricula: str
    nombre: str
    email: str
    cargo: str
    pais: Optional[str] = None
    certificaciones: List[Certificacion] = []
    skills: List[Skill] = []
    lider: Optional[Lider] = None
    match_principal: str  # Cert/skill que matcheo la busqueda
    score: float  # Score de similitud (0-1)


class TalentSearchRequest(BaseModel):
    """Request para busqueda de talento."""
    consulta: str = Field(..., description="Descripcion del perfil buscado")
    limit: int = Field(10, ge=1, le=50, description="Maximo de resultados")
    pais: Optional[str] = Field(None, description="Filtrar por pais")


class TalentSearchResponse(BaseModel):
    """Response de busqueda de talento."""
    exito: bool
    mensaje: str
    candidatos: List[PerfilCompleto]
    total: int


class RequerimientoRol(BaseModel):
    """Rol requerido para batch search."""
    rol_id: str = Field(..., description="ID unico del rol (ej: PM_Senior)")
    descripcion: str = Field(..., description="Skills y certificaciones requeridas")
    pais: Optional[str] = Field(None, description="Filtro por pais")
    cantidad: int = Field(3, ge=1, le=20, description="Candidatos a retornar")


class BatchSearchRequest(BaseModel):
    """Request para busqueda batch."""
    roles: List[RequerimientoRol]


class RolResultado(BaseModel):
    """Resultado de un rol."""
    rol_id: str
    descripcion: str
    candidatos: List[PerfilCompleto]
    total: int


class BatchSearchResponse(BaseModel):
    """Response de busqueda batch."""
    exito: bool
    mensaje: str
    resultados: Dict[str, RolResultado]
    total_roles: int
    total_candidatos: int


class ChatRequest(BaseModel):
    """Request para chat con lenguaje natural."""
    mensaje: str = Field(..., description="Consulta en lenguaje natural", 
                         examples=["Necesito 3 desarrolladores Java senior para Chile"])
    pais_default: Optional[str] = Field(None, description="Pais por defecto si no se especifica")


class ChatResponse(BaseModel):
    """Response del chat."""
    exito: bool
    mensaje_original: str
    interpretacion: Dict[str, Any]  # Lo que Gemini interpreto
    candidatos: List[PerfilCompleto]
    total: int
    respuesta_natural: str  # Respuesta en lenguaje natural


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    gemini_disponible: bool
    total_certificaciones: int
    total_skills: int
    total_colaboradores: int
    modelo_embeddings: str


class CountriesResponse(BaseModel):
    """Lista de paises."""
    exito: bool
    paises: List[str]
    total: int


class StatsResponse(BaseModel):
    """Estadisticas del sistema."""
    exito: bool
    estadisticas: Dict[str, Any]


# ============================================
# VARIABLES GLOBALES (CACHE)
# ============================================

_model: SentenceTransformer = None
_db: lancedb.DBConnection = None
_table_certs = None
_table_skills = None
_df_certs_raw: pd.DataFrame = None  # Cache de certificaciones crudas
_df_skills_raw: pd.DataFrame = None  # Cache de skills crudos
_available_countries: List[str] = []


def get_model() -> SentenceTransformer:
    """Carga el modelo de embeddings (singleton)."""
    global _model
    if _model is None:
        logger.info(f"Cargando modelo: {EMBEDDING_MODEL}")
        _model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("Modelo cargado")
    return _model


def find_column(df: pd.DataFrame, names: list) -> Optional[str]:
    """Encuentra columna por nombres posibles."""
    for name in names:
        if name in df.columns:
            return name
        for col in df.columns:
            if name.lower() in col.lower():
                return col
    return None


def get_col_value(row, names: list, default: str = "") -> str:
    """Obtiene valor de columna."""
    for name in names:
        if name in row.index:
            val = row[name]
            if pd.notna(val) and str(val).strip():
                return str(val).strip()
    return default


# ============================================
# CARGA DE DATOS
# ============================================

def load_certifications_raw() -> pd.DataFrame:
    """Carga certificaciones sin filtrar para enriquecimiento."""
    global _df_certs_raw, _available_countries
    
    if _df_certs_raw is not None:
        return _df_certs_raw
    
    if not CERT_FILE.exists():
        logger.warning(f"Archivo no encontrado: {CERT_FILE}")
        return pd.DataFrame()
    
    logger.info(f"Cargando certificaciones: {CERT_FILE}")
    df = pd.read_excel(CERT_FILE, engine="openpyxl")
    df = df.fillna("")
    
    # Filtros obligatorios
    status_col = find_column(df, ["Status"])
    if status_col:
        df = df[df[status_col].astype(str).str.strip().str.lower() == "verificado"]
    
    expirado_col = find_column(df, ["Expirado"])
    if expirado_col:
        df = df[df[expirado_col].astype(str).str.strip().str.lower().isin(["nao", "não", "no", "n"])]
    
    logger.info(f"Certificaciones filtradas: {len(df)}")
    
    # Paises disponibles
    pais_col = find_column(df, ["[Colaborador] País", "[Colaborador] Pais", "Pais"])
    if pais_col:
        _available_countries = sorted([p for p in df[pais_col].astype(str).str.strip().unique() if p])
    
    _df_certs_raw = df
    return df


def load_skills_raw() -> pd.DataFrame:
    """Carga skills sin filtrar para enriquecimiento."""
    global _df_skills_raw
    
    if _df_skills_raw is not None:
        return _df_skills_raw
    
    if not RRHH_FILE.exists():
        logger.warning(f"Archivo no encontrado: {RRHH_FILE}")
        return pd.DataFrame()
    
    logger.info(f"Cargando skills/RRHH: {RRHH_FILE}")
    df = pd.read_excel(RRHH_FILE, engine="openpyxl")
    df = df.fillna("")
    
    # Filtrar solo activos
    status_col = find_column(df, ["Status Colaborador", "Status"])
    if status_col:
        df = df[df[status_col].astype(str).str.strip().str.lower() == "ativo"]
    
    logger.info(f"Skills/RRHH filtrados: {len(df)}")
    
    _df_skills_raw = df
    return df


def get_all_certs_for_matricula(matricula: str) -> List[Certificacion]:
    """Obtiene TODAS las certificaciones de un empleado."""
    df = load_certifications_raw()
    if df.empty:
        return []
    
    mat_col = find_column(df, ["[Colaborador] Matricula", "Matricula"])
    if not mat_col:
        return []
    
    employee_certs = df[df[mat_col].astype(str).str.strip() == str(matricula).strip()]
    
    certs = []
    for _, row in employee_certs.iterrows():
        certs.append(Certificacion(
            nombre=get_col_value(row, ["Certificação", "Certificacao"]),
            institucion=get_col_value(row, ["Instituição", "Instituicao"]),
            fecha_emision=get_col_value(row, ["Data de emissão", "Data de emissao"]),
            fecha_expiracion=get_col_value(row, ["Data de expiração", "Data de expiracao"])
        ))
    
    return certs


def get_all_skills_for_matricula(matricula: str) -> List[Skill]:
    """Obtiene TODOS los skills de un empleado."""
    df = load_skills_raw()
    if df.empty:
        return []
    
    mat_col = find_column(df, ["Matrícula", "Matricula"])
    if not mat_col:
        return []
    
    employee_skills = df[df[mat_col].astype(str).str.strip() == str(matricula).strip()]
    
    skills = []
    seen = set()
    for _, row in employee_skills.iterrows():
        skill_name = get_col_value(row, ["Conhecimento", "Skill"])
        if skill_name and skill_name not in seen:
            seen.add(skill_name)
            prof_str = get_col_value(row, ["Nível de Proficiência", "Proficiencia"])
            prof = int(prof_str) if prof_str.isdigit() else None
            
            skills.append(Skill(
                nombre=skill_name,
                categoria=get_col_value(row, ["Categoria", "Grupo"]),
                proficiencia=prof
            ))
    
    return skills


def get_leader_info(row_or_matricula) -> Optional[Lider]:
    """Obtiene info del lider."""
    if isinstance(row_or_matricula, str):
        # Buscar en skills raw
        df = load_skills_raw()
        if df.empty:
            return None
        mat_col = find_column(df, ["Matrícula", "Matricula"])
        if not mat_col:
            return None
        matches = df[df[mat_col].astype(str).str.strip() == str(row_or_matricula).strip()]
        if matches.empty:
            return None
        row = matches.iloc[0]
    else:
        row = row_or_matricula
    
    lider_nombre = get_col_value(row, ["Nome do Líder", "[Liderança] Nome", "Lider"])
    lider_email = get_col_value(row, ["Email do Líder", "[Liderança] Email"])
    
    if lider_nombre or lider_email:
        return Lider(nombre=lider_nombre or None, email=lider_email or None)
    return None


# ============================================
# INICIALIZACION VECTOR DB
# ============================================

def initialize_vector_db(force_rebuild: bool = False):
    """Inicializa bases de datos vectoriales."""
    global _db, _table_certs, _table_skills
    
    model = get_model()
    LANCEDB_PATH.mkdir(parents=True, exist_ok=True)
    _db = lancedb.connect(str(LANCEDB_PATH))
    existing = _db.table_names()
    
    # === CERTIFICACIONES ===
    if TABLE_CERTS in existing and not force_rebuild:
        logger.info(f"Reutilizando tabla {TABLE_CERTS}")
        _table_certs = _db.open_table(TABLE_CERTS)
    else:
        df = load_certifications_raw()
        if not df.empty:
            logger.info("Indexando certificaciones...")
            
            mat_col = find_column(df, ["[Colaborador] Matricula", "Matricula"])
            
            # Crear contexto de busqueda
            contexts = []
            records = []
            for idx, (_, row) in enumerate(df.iterrows()):
                cargo = get_col_value(row, ["[Colaborador] Cargo", "Cargo"])
                cert = get_col_value(row, ["Certificação", "Certificacao"])
                inst = get_col_value(row, ["Instituição", "Instituicao"])
                pais = get_col_value(row, ["[Colaborador] País", "[Colaborador] Pais"])
                
                context = f"{cargo} {cert} {inst} {pais}".strip()
                contexts.append(context)
                
                records.append({
                    "id": idx,
                    "matricula": str(row[mat_col]).strip() if mat_col else "",
                    "nombre": get_col_value(row, ["[Colaborador] Nome", "Nome"]),
                    "email": get_col_value(row, ["[Colaborador] Email", "Email"]),
                    "cargo": cargo,
                    "certificacion": cert,
                    "institucion": inst,
                    "pais": pais,
                    "context": context
                })
            
            embeddings = model.encode(contexts, show_progress_bar=True)
            for i, rec in enumerate(records):
                rec["vector"] = embeddings[i].tolist()
            
            if TABLE_CERTS in existing:
                _db.drop_table(TABLE_CERTS)
            _table_certs = _db.create_table(TABLE_CERTS, records)
            logger.info(f"Tabla {TABLE_CERTS}: {len(records)} registros")
    
    # === SKILLS ===
    if TABLE_SKILLS in existing and not force_rebuild:
        logger.info(f"Reutilizando tabla {TABLE_SKILLS}")
        _table_skills = _db.open_table(TABLE_SKILLS)
    else:
        df = load_skills_raw()
        if not df.empty:
            logger.info("Indexando skills...")
            
            mat_col = find_column(df, ["Matrícula", "Matricula"])
            skill_col = find_column(df, ["Conhecimento", "Skill"])
            
            # Filtrar filas con skill
            df_with_skill = df[df[skill_col].astype(str).str.strip() != ""] if skill_col else df
            
            contexts = []
            records = []
            for idx, (_, row) in enumerate(df_with_skill.iterrows()):
                cargo = get_col_value(row, ["Cargo"])
                skill = get_col_value(row, ["Conhecimento", "Skill"])
                categoria = get_col_value(row, ["Categoria", "Grupo"])
                
                context = f"{cargo} {skill} {categoria}".strip()
                contexts.append(context)
                
                prof_str = get_col_value(row, ["Nível de Proficiência", "Proficiencia"])
                
                records.append({
                    "id": idx,
                    "matricula": str(row[mat_col]).strip() if mat_col else "",
                    "nombre": get_col_value(row, ["Colaborador", "Nome"]),
                    "email": get_col_value(row, ["Email"]),
                    "cargo": cargo,
                    "skill": skill,
                    "categoria": categoria,
                    "proficiencia": prof_str,
                    "lider_nombre": get_col_value(row, ["Nome do Líder"]),
                    "lider_email": get_col_value(row, ["Email do Líder"]),
                    "context": context
                })
            
            if records:
                embeddings = model.encode(contexts, show_progress_bar=True)
                for i, rec in enumerate(records):
                    rec["vector"] = embeddings[i].tolist()
                
                if TABLE_SKILLS in existing:
                    _db.drop_table(TABLE_SKILLS)
                _table_skills = _db.create_table(TABLE_SKILLS, records)
                logger.info(f"Tabla {TABLE_SKILLS}: {len(records)} registros")


# ============================================
# BUSQUEDA Y ENRIQUECIMIENTO
# ============================================

def search_and_enrich(query: str, limit: int = 10, pais: Optional[str] = None) -> List[PerfilCompleto]:
    """
    Busca candidatos y retorna perfiles ENRIQUECIDOS con todas sus certs y skills.
    """
    if _table_certs is None and _table_skills is None:
        return []
    
    model = get_model()
    query_vector = model.encode([query])[0].tolist()
    
    candidatos_raw: Dict[str, Dict] = {}  # matricula -> data
    
    # Buscar en certificaciones
    if _table_certs:
        search_limit = limit * 5 if pais else limit * 3
        results = _table_certs.search(query_vector).limit(search_limit).to_pandas()
        
        if pais:
            results = results[results["pais"].str.lower() == pais.lower()]
        
        for _, row in results.iterrows():
            mat = str(row.get("matricula", "")).strip()
            if not mat:
                continue
            
            dist = float(row.get("_distance", 0))
            score = 1 / (1 + dist)
            
            if mat not in candidatos_raw or score > candidatos_raw[mat]["score"]:
                candidatos_raw[mat] = {
                    "matricula": mat,
                    "nombre": row.get("nombre", ""),
                    "email": row.get("email", ""),
                    "cargo": row.get("cargo", ""),
                    "pais": row.get("pais", ""),
                    "match_principal": row.get("certificacion", ""),
                    "score": score,
                    "source": "certificacion"
                }
    
    # Buscar en skills (complementar)
    if _table_skills and len(candidatos_raw) < limit:
        results = _table_skills.search(query_vector).limit(limit * 3).to_pandas()
        
        for _, row in results.iterrows():
            mat = str(row.get("matricula", "")).strip()
            if not mat:
                continue
            
            dist = float(row.get("_distance", 0))
            score = 1 / (1 + dist)
            
            if mat not in candidatos_raw or score > candidatos_raw[mat]["score"]:
                candidatos_raw[mat] = {
                    "matricula": mat,
                    "nombre": row.get("nombre", ""),
                    "email": row.get("email", ""),
                    "cargo": row.get("cargo", ""),
                    "pais": None,
                    "match_principal": row.get("skill", ""),
                    "score": score,
                    "source": "skill",
                    "lider_nombre": row.get("lider_nombre"),
                    "lider_email": row.get("lider_email")
                }
    
    # Ordenar por score y limitar
    sorted_candidates = sorted(candidatos_raw.values(), key=lambda x: x["score"], reverse=True)[:limit]
    
    # ENRIQUECER cada candidato
    perfiles = []
    for cand in sorted_candidates:
        mat = cand["matricula"]
        
        # Obtener TODAS las certificaciones
        all_certs = get_all_certs_for_matricula(mat)
        
        # Obtener TODOS los skills
        all_skills = get_all_skills_for_matricula(mat)
        
        # Obtener lider
        lider = None
        if cand.get("lider_nombre") or cand.get("lider_email"):
            lider = Lider(nombre=cand.get("lider_nombre"), email=cand.get("lider_email"))
        else:
            lider = get_leader_info(mat)
        
        perfiles.append(PerfilCompleto(
            matricula=mat,
            nombre=cand["nombre"],
            email=cand["email"],
            cargo=cand["cargo"],
            pais=cand.get("pais"),
            certificaciones=all_certs,
            skills=all_skills,
            lider=lider,
            match_principal=cand["match_principal"],
            score=round(cand["score"], 4)
        ))
    
    return perfiles


def search_for_roles(roles: List[RequerimientoRol]) -> Dict[str, RolResultado]:
    """Busqueda batch para multiples roles."""
    resultados = {}
    
    for rol in roles:
        logger.info(f"Buscando: {rol.rol_id} - {rol.descripcion[:50]}...")
        
        candidatos = search_and_enrich(
            query=rol.descripcion,
            limit=rol.cantidad,
            pais=rol.pais
        )
        
        resultados[rol.rol_id] = RolResultado(
            rol_id=rol.rol_id,
            descripcion=rol.descripcion,
            candidatos=candidatos,
            total=len(candidatos)
        )
    
    return resultados


# ============================================
# GEMINI INTEGRATION
# ============================================

async def call_gemini(prompt: str, system_prompt: str = "") -> Optional[str]:
    """Llama a Gemini API."""
    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY no configurada")
        return None
    
    url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    
    contents = []
    if system_prompt:
        contents.append({"role": "user", "parts": [{"text": system_prompt}]})
        contents.append({"role": "model", "parts": [{"text": "Entendido, seguiré esas instrucciones."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "candidates" in data and data["candidates"]:
                return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.error(f"Error llamando Gemini: {e}")
    
    return None


async def interpret_natural_query(mensaje: str) -> Dict[str, Any]:
    """Usa Gemini para interpretar consulta en lenguaje natural."""
    
    system_prompt = """Eres un asistente que interpreta solicitudes de busqueda de talento/personal.
    
Debes extraer la siguiente informacion y responder SOLO con un JSON valido (sin markdown, sin explicaciones):
{
  "roles": [
    {
      "rol_id": "identificador_corto",
      "descripcion": "skills y certificaciones requeridas como palabras clave",
      "pais": "pais si se menciona o null",
      "cantidad": numero_de_personas
    }
  ],
  "resumen": "breve resumen de lo que se busca"
}

Ejemplos:
- "Necesito 3 desarrolladores Java para Chile" -> descripcion: "Java Spring Boot Backend Developer"
- "Busco un PM con PMP" -> descripcion: "Project Manager PMP Scrum Agile"
- "5 personas de frontend" -> descripcion: "React Angular Vue JavaScript Frontend Developer"

IMPORTANTE:
- Siempre expande las descripciones con tecnologias relacionadas
- Si no se especifica cantidad, usa 3
- Si no se especifica pais, usa null
- El rol_id debe ser corto y descriptivo (ej: Dev_Java, PM_Senior, DBA_Oracle)
"""
    
    result = await call_gemini(mensaje, system_prompt)
    
    if not result:
        # Fallback: interpretacion basica
        return {
            "roles": [{
                "rol_id": "General",
                "descripcion": mensaje,
                "pais": None,
                "cantidad": 5
            }],
            "resumen": mensaje
        }
    
    # Limpiar respuesta (quitar markdown si existe)
    result = result.strip()
    if result.startswith("```"):
        result = re.sub(r'^```\w*\n?', '', result)
        result = re.sub(r'\n?```$', '', result)
    
    try:
        return json.loads(result)
    except json.JSONDecodeError:
        logger.warning(f"No se pudo parsear respuesta de Gemini: {result[:100]}")
        return {
            "roles": [{
                "rol_id": "General",
                "descripcion": mensaje,
                "pais": None,
                "cantidad": 5
            }],
            "resumen": mensaje
        }


async def generate_natural_response(candidatos: List[PerfilCompleto], query: str) -> str:
    """Genera respuesta en lenguaje natural."""
    if not candidatos:
        return f"No encontré candidatos que coincidan con tu búsqueda: '{query}'"
    
    # Construir resumen para Gemini
    resumen = f"Consulta: {query}\n\nCandidatos encontrados ({len(candidatos)}):\n"
    for i, c in enumerate(candidatos[:5], 1):
        certs_str = ", ".join([cert.nombre[:30] for cert in c.certificaciones[:3]]) if c.certificaciones else "Sin certificaciones"
        skills_str = ", ".join([s.nombre for s in c.skills[:5]]) if c.skills else "Sin skills registrados"
        resumen += f"\n{i}. {c.nombre} ({c.cargo})"
        resumen += f"\n   - Certs: {certs_str}"
        resumen += f"\n   - Skills: {skills_str}"
        resumen += f"\n   - Match: {c.match_principal} (score: {c.score:.0%})"
    
    prompt = f"""Basándote en estos resultados de búsqueda, genera una respuesta breve y profesional para el usuario:

{resumen}

La respuesta debe:
1. Confirmar cuántos candidatos se encontraron
2. Destacar los 2-3 mejores candidatos brevemente
3. Ser concisa (3-4 oraciones máximo)"""

    result = await call_gemini(prompt)
    
    if result:
        return result
    
    # Fallback
    return f"Encontré {len(candidatos)} candidatos. El mejor match es {candidatos[0].nombre} ({candidatos[0].cargo}) con {len(candidatos[0].certificaciones)} certificaciones y {len(candidatos[0].skills)} skills."


# ============================================
# ESTADISTICAS
# ============================================

def get_statistics() -> Dict[str, Any]:
    """Obtiene estadisticas del sistema."""
    stats = {}
    
    if _table_certs:
        df = _table_certs.to_pandas()
        stats["certificaciones"] = {
            "total": len(df),
            "colaboradores_unicos": df["matricula"].nunique(),
            "por_pais": df["pais"].value_counts().head(10).to_dict(),
            "top_instituciones": df["institucion"].value_counts().head(10).to_dict()
        }
    
    if _table_skills:
        df = _table_skills.to_pandas()
        stats["skills"] = {
            "total": len(df),
            "colaboradores_unicos": df["matricula"].nunique(),
            "top_skills": df["skill"].value_counts().head(20).to_dict()
        }
    
    stats["paises_disponibles"] = _available_countries
    
    return stats


# ============================================
# FASTAPI APPLICATION
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle: inicializa DB al arrancar."""
    logger.info("=" * 60)
    logger.info("MCP Talent Search Server v3.0")
    logger.info(f"Gemini: {GEMINI_MODEL} ({'configurado' if GOOGLE_API_KEY else 'NO configurado'})")
    logger.info("=" * 60)
    
    try:
        initialize_vector_db()
    except Exception as e:
        logger.error(f"Error inicializando: {e}")
    
    yield
    logger.info("Servidor detenido")


app = FastAPI(
    title="MCP Talent Search API",
    description="""
## Sistema de Búsqueda Semántica de Talento

API para encontrar candidatos idóneos basándose en certificaciones y skills técnicos.

### Características principales:

- **Perfiles Enriquecidos**: Retorna TODAS las certificaciones y skills de cada candidato
- **Búsqueda Semántica**: Encuentra matches por significado, no solo palabras exactas  
- **Chat Natural**: Endpoint `/chat` con Gemini para consultas en lenguaje natural
- **Multilingüe**: Busca en portugués aunque la consulta sea en español

### Filtros automáticos:
- Solo certificaciones verificadas y no expiradas
- Solo colaboradores activos

### Ejemplo de uso:
```python
# Búsqueda simple
POST /search
{"consulta": "Java Spring Microservicios", "limit": 5}

# Chat natural
POST /chat  
{"mensaje": "Necesito 3 desarrolladores senior de React para Chile"}
```
    """,
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="MCP Talent Search API",
        version="3.0.0",
        description=app.description,
        routes=app.routes,
    )
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://www.tivit.com/wp-content/uploads/2021/09/logo-tivit.svg"
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi


# === ENDPOINTS ===

@app.get("/health", response_model=HealthResponse, tags=["Sistema"])
async def health_check():
    """Verifica el estado del servicio."""
    return HealthResponse(
        status="healthy" if _table_certs else "degraded",
        version="3.0.0",
        gemini_disponible=bool(GOOGLE_API_KEY),
        total_certificaciones=_table_certs.count_rows() if _table_certs else 0,
        total_skills=_table_skills.count_rows() if _table_skills else 0,
        total_colaboradores=len(set(
            list(_table_certs.to_pandas()["matricula"].unique()) if _table_certs else []
        )),
        modelo_embeddings=EMBEDDING_MODEL
    )


@app.get("/countries", response_model=CountriesResponse, tags=["Sistema"])
async def get_countries():
    """Lista países disponibles para filtrar."""
    return CountriesResponse(
        exito=True,
        paises=_available_countries,
        total=len(_available_countries)
    )


@app.get("/stats", response_model=StatsResponse, tags=["Sistema"])
async def get_stats():
    """Obtiene estadísticas del sistema."""
    return StatsResponse(
        exito=True,
        estadisticas=get_statistics()
    )


@app.post("/search", response_model=TalentSearchResponse, tags=["Búsqueda"])
async def search_talent(request: TalentSearchRequest):
    """
    Busca candidatos con perfiles enriquecidos.
    
    Retorna candidatos con TODAS sus certificaciones y skills, no solo el match principal.
    """
    if _table_certs is None and _table_skills is None:
        raise HTTPException(503, "Base de datos no inicializada")
    
    logger.info(f"Búsqueda: '{request.consulta}' | pais={request.pais} | limit={request.limit}")
    
    candidatos = search_and_enrich(request.consulta, request.limit, request.pais)
    
    return TalentSearchResponse(
        exito=bool(candidatos),
        mensaje=f"Se encontraron {len(candidatos)} candidatos" if candidatos else "No se encontraron candidatos",
        candidatos=candidatos,
        total=len(candidatos)
    )


@app.post("/batch-search", response_model=BatchSearchResponse, tags=["Búsqueda"])
async def batch_search(request: BatchSearchRequest):
    """
    Busca candidatos para múltiples roles en una sola llamada.
    
    Ideal para Team Building de RFPs donde se necesitan varios perfiles diferentes.
    """
    if _table_certs is None and _table_skills is None:
        raise HTTPException(503, "Base de datos no inicializada")
    
    logger.info(f"Batch search: {len(request.roles)} roles")
    
    resultados = search_for_roles(request.roles)
    total_candidatos = sum(r.total for r in resultados.values())
    
    return BatchSearchResponse(
        exito=True,
        mensaje=f"Búsqueda completada: {len(request.roles)} roles, {total_candidatos} candidatos",
        resultados=resultados,
        total_roles=len(request.roles),
        total_candidatos=total_candidatos
    )


@app.post("/chat", response_model=ChatResponse, tags=["Chat Natural"])
async def chat_natural(request: ChatRequest):
    """
    Consulta en lenguaje natural usando Gemini.
    
    Interpreta automáticamente la solicitud y busca candidatos relevantes.
    
    Ejemplos:
    - "Necesito 3 desarrolladores Java para un proyecto en Chile"
    - "Busco un Project Manager con certificación PMP"
    - "Dame 5 personas que sepan de cloud AWS o Azure"
    """
    if _table_certs is None and _table_skills is None:
        raise HTTPException(503, "Base de datos no inicializada")
    
    logger.info(f"Chat: '{request.mensaje}'")
    
    # Interpretar con Gemini
    interpretacion = await interpret_natural_query(request.mensaje)
    
    # Aplicar pais default si no se especifico
    if request.pais_default:
        for rol in interpretacion.get("roles", []):
            if not rol.get("pais"):
                rol["pais"] = request.pais_default
    
    # Buscar candidatos
    roles = [RequerimientoRol(**r) for r in interpretacion.get("roles", [])]
    resultados = search_for_roles(roles)
    
    # Aplanar candidatos
    todos_candidatos = []
    for resultado in resultados.values():
        todos_candidatos.extend(resultado.candidatos)
    
    # Deduplicar por matricula (mantener mejor score)
    seen = {}
    for c in todos_candidatos:
        if c.matricula not in seen or c.score > seen[c.matricula].score:
            seen[c.matricula] = c
    candidatos_unicos = sorted(seen.values(), key=lambda x: x.score, reverse=True)
    
    # Generar respuesta natural
    respuesta = await generate_natural_response(candidatos_unicos, request.mensaje)
    
    return ChatResponse(
        exito=bool(candidatos_unicos),
        mensaje_original=request.mensaje,
        interpretacion=interpretacion,
        candidatos=candidatos_unicos,
        total=len(candidatos_unicos),
        respuesta_natural=respuesta
    )


@app.post("/reindex", tags=["Sistema"])
async def reindex():
    """Reconstruye los índices vectoriales."""
    try:
        logger.info("Reconstruyendo índices...")
        
        # Limpiar cache
        global _df_certs_raw, _df_skills_raw
        _df_certs_raw = None
        _df_skills_raw = None
        
        initialize_vector_db(force_rebuild=True)
        
        return {
            "exito": True,
            "mensaje": "Índices reconstruidos",
            "certificaciones": _table_certs.count_rows() if _table_certs else 0,
            "skills": _table_skills.count_rows() if _table_skills else 0
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ============================================
# MCP TOOLS (si MCP está disponible)
# ============================================

try:
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP("talent-search")
    MCP_AVAILABLE = True
    
    @mcp.tool()
    def buscar_talento(consulta: str, pais: str = None, limit: int = 10) -> str:
        """
        Busca candidatos con perfiles enriquecidos (todas las certs y skills).
        
        Args:
            consulta: Skills o certificaciones buscadas
            pais: Filtro por país (opcional)
            limit: Máximo de resultados
        """
        candidatos = search_and_enrich(consulta, limit, pais)
        return json.dumps({
            "exito": bool(candidatos),
            "total": len(candidatos),
            "candidatos": [c.model_dump() for c in candidatos]
        }, ensure_ascii=False, indent=2)
    
    @mcp.tool()
    def buscar_equipo(roles_json: str) -> str:
        """
        Busca equipo completo para múltiples roles.
        
        Args:
            roles_json: JSON con formato:
                [{"rol_id": "Dev_Java", "descripcion": "Java Spring", "pais": "Chile", "cantidad": 3}]
        """
        try:
            roles_data = json.loads(roles_json)
            roles = [RequerimientoRol(**r) for r in roles_data]
            resultados = search_for_roles(roles)
            
            output = {}
            for rol_id, res in resultados.items():
                output[rol_id] = {
                    "descripcion": res.descripcion,
                    "total": res.total,
                    "candidatos": [c.model_dump() for c in res.candidatos]
                }
            
            return json.dumps({"exito": True, "resultados": output}, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"exito": False, "error": str(e)}, ensure_ascii=False)
    
    @mcp.tool()
    def listar_paises() -> str:
        """Lista países disponibles."""
        return json.dumps({"paises": _available_countries}, ensure_ascii=False)

except ImportError:
    MCP_AVAILABLE = False
    mcp = None
    logger.info("MCP no disponible")


# ============================================
# MAIN
# ============================================

def main():
    mode = os.environ.get("MCP_MODE", "http").lower()
    
    if mode == "mcp" and MCP_AVAILABLE:
        logger.info("Modo MCP (stdio)")
        initialize_vector_db()
        mcp.run()
    else:
        port = int(os.environ.get("MCP_PORT", "8083"))
        logger.info(f"Modo HTTP en puerto {port}")
        logger.info(f"Documentación: http://localhost:{port}/docs")
        uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
