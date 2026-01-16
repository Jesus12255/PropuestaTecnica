# Plan de Integración de CVs al MCP Talent Search

> **Estado:** Pendiente de implementación  
> **Última actualización:** Enero 2025  
> **Impacto:** MCP + Backend + Frontend

---

## 📋 Resumen del Problema

**Situación actual:**
- El MCP busca candidatos SOLO en datos estructurados (Excel):
  - `Capital_Intelectual.xlsx` → Certificaciones
  - `Census.xlsx` → Skills/RRHH
- Si un profesional sabe Java pero NO tiene "Java" en sus certificaciones/skills registrados, **no aparece en las búsquedas**

**Problema:**
- Hay ~40 CVs con información rica que no está capturada en los Excel
- Muchos profesionales tienen habilidades/experiencias en sus CVs que no están formalizadas en el sistema
- Pérdida de talento valioso en las búsquedas
- **Los CVs están nombrados por nombre completo** (ej: `PACO ALEJANDRO PEREZ GUTIERREZ.pdf`), no por matrícula

**Requerimientos:**
1. Buscar también en el contenido de los CVs
2. **Permitir descargar los CVs** de los candidatos que matchean

**Solución propuesta:**
- Agregar una tercera fuente de búsqueda: **CVs indexados**
- Matching automático por nombre (fuzzy match) para vincular CV → matrícula
- Endpoint de descarga de CVs
- Cambios en las 3 capas: MCP, Backend y Frontend

---

## 🏗 Arquitectura Completa (3 Capas)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                           (React + Vite)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  Candidato: Juan Pérez                              Score: 87.5       │ │
│   │  Cargo: Senior Developer                                              │ │
│   │  ─────────────────────────────────────────────────────────────────── │ │
│   │  📜 Certificaciones: AWS Solutions Architect, Java SE 11             │ │
│   │  🛠 Skills: Python (5), React (4), Docker (4)                        │ │
│   │  ─────────────────────────────────────────────────────────────────── │ │
│   │  📄 Match en CV:                                                      │ │
│   │     "...5 años de experiencia en Java Spring Boot..."                │ │
│   │  ─────────────────────────────────────────────────────────────────── │ │
│   │                                                                       │ │
│   │  [📥 Descargar CV]  ← NUEVO: Botón de descarga                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ GET /api/v1/cvs/{matricula}/download
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│                        (FastAPI - Puerto 8000)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   NUEVO ENDPOINT (Proxy con autenticación):                                 │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  GET /api/v1/cvs/{matricula}/download                                 │ │
│   │                                                                        │ │
│   │  1. Verificar JWT (usuario autenticado)                               │ │
│   │  2. Llamar al MCP: GET /cvs/download/{matricula}                      │ │
│   │  3. Retornar archivo al frontend                                      │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ GET /cvs/download/{matricula}
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                MCP                                           │
│                        (FastAPI - Puerto 8080)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ENDPOINTS EXISTENTES (modificados):                                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│   │  /search    │  │   /chat     │  │   /health   │                         │
│   │  + CVs      │  │   + CVs     │  │   + CV info │                         │
│   └──────┬──────┘  └──────┬──────┘  └─────────────┘                         │
│          │                │                                                  │
│          └───────┬────────┘                                                  │
│                  ▼                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              search_and_enrich() MODIFICADO                          │   │
│   │                                                                      │   │
│   │  1. Buscar en certificaciones (LanceDB)   ───┐                      │   │
│   │  2. Buscar en skills (LanceDB)            ───┼─→ FUSIONAR + DEDUP   │   │
│   │  3. Buscar en CVs (LanceDB) ⭐ NUEVO       ───┘                      │   │
│   │                                                                      │   │
│   │  Response incluye:                                                   │   │
│   │  - cv_matches[]: extractos del CV que matchearon                    │   │
│   │  - tiene_cv: boolean                                                 │   │
│   │  - cv_filename: nombre del archivo para descarga                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   NUEVOS ENDPOINTS:                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GET  /cvs/download/{matricula}  → Descarga el archivo PDF/DOCX     │   │
│   │  POST /reindex-cvs               → Reindexar solo CVs               │   │
│   │  GET  /cvs/mapping-review        → Ver mapeo nombre→matrícula       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   TABLAS LANCEDB:                                                            │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────────────┐   │
│   │ certs       │  │ skills      │  │ cvs ⭐ NUEVO                      │   │
│   │ - matricula │  │ - matricula │  │ - matricula (inferida de nombre) │   │
│   │ - cert      │  │ - skill     │  │ - chunk_text                     │   │
│   │ - vector[]  │  │ - vector[]  │  │ - cv_filename                    │   │
│   └─────────────┘  └─────────────┘  │ - vector[]                       │   │
│                                      └──────────────────────────────────┘   │
│                                                 │                            │
│                                                 ▼                            │
│                                      ┌──────────────────────────────────┐   │
│                                      │    📁 cvs/                        │   │
│                                      │  ├── PACO ALEJANDRO PEREZ.pdf    │   │
│                                      │  ├── MARIA GARCIA LOPEZ.docx     │   │
│                                      │  └── ... (40 CVs)                │   │
│                                      └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Matching por Nombre (CV → Matrícula)

### El Problema
Los CVs están nombrados así:
```
PACO ALEJANDRO PEREZ GUTIERREZ.pdf
MARIA JOSE GARCIA LOPEZ.docx
```

Pero necesitamos la **matrícula** para vincular con certificaciones/skills.

### La Solución: Fuzzy Matching

```python
# Flujo de matching
CV: "PACO ALEJANDRO PEREZ GUTIERREZ.pdf"
    ↓ extraer nombre del filename
   "PACO ALEJANDRO PEREZ GUTIERREZ"
    ↓ normalizar (minúsculas, sin acentos)
   "paco alejandro perez gutierrez"
    ↓ buscar en Census.xlsx columna "Colaborador"
   "Paco Alejandro Pérez Gutiérrez" → matrícula: 12345 ✓
```

### Algoritmo de Matching

```python
from rapidfuzz import fuzz, process

def match_cv_to_matricula(cv_filename: str, df_census: pd.DataFrame) -> Optional[Tuple[str, float]]:
    """
    Encuentra la matrícula que corresponde a un CV por nombre.
    
    Returns:
        Tuple[matricula, confianza] o None si no hay match
    """
    # Extraer nombre del archivo
    name_from_file = Path(cv_filename).stem  # Sin extensión
    name_normalized = normalize_name(name_from_file)
    
    # Buscar en Census
    colaborador_col = find_column(df_census, ["Colaborador", "Nome"])
    matricula_col = find_column(df_census, ["Matrícula", "Matricula"])
    
    # Crear lista de candidatos únicos
    candidates = df_census[[matricula_col, colaborador_col]].drop_duplicates()
    
    # Fuzzy match
    best_match = None
    best_score = 0
    
    for _, row in candidates.iterrows():
        name_census = normalize_name(str(row[colaborador_col]))
        
        # Usar múltiples algoritmos de similitud
        score_ratio = fuzz.ratio(name_normalized, name_census)
        score_partial = fuzz.partial_ratio(name_normalized, name_census)
        score_token = fuzz.token_sort_ratio(name_normalized, name_census)
        
        # Promedio ponderado
        score = (score_ratio * 0.3 + score_partial * 0.3 + score_token * 0.4)
        
        if score > best_score:
            best_score = score
            best_match = str(row[matricula_col])
    
    # Threshold de confianza
    if best_score >= 80:
        return (best_match, best_score)
    elif best_score >= 60:
        # Match probable pero requiere revisión
        return (best_match, best_score)  # Se marca para revisión
    else:
        return None


def normalize_name(name: str) -> str:
    """Normaliza un nombre para comparación."""
    import unicodedata
    
    # Minúsculas
    name = name.lower()
    
    # Remover acentos
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    
    # Solo letras y espacios
    name = re.sub(r'[^a-z\s]', '', name)
    
    # Normalizar espacios
    name = ' '.join(name.split())
    
    return name
```

### Archivo de Mapeo Generado

El sistema genera automáticamente `cv_mapping.xlsx` con los resultados:

| Archivo CV | Nombre Extraído | Matrícula | Nombre Census | Confianza | Estado |
|------------|-----------------|-----------|---------------|-----------|--------|
| PACO ALEJANDRO PEREZ GUTIERREZ.pdf | Paco Alejandro Perez Gutierrez | 12345 | Paco Alejandro Pérez Gutiérrez | 95% | ✅ Auto |
| MARIA GARCIA.pdf | Maria Garcia | 12346 | María García López | 78% | ⚠️ Revisar |
| JOHN DOE.pdf | John Doe | - | - | 0% | ❌ No encontrado |

**Estados:**
- ✅ **Auto**: Confianza >= 80%, se usa automáticamente
- ⚠️ **Revisar**: Confianza 60-79%, requiere validación manual
- ❌ **No encontrado**: Sin match, requiere mapeo manual

---

## 📂 Estructura de Archivos

```
mcp/
├── server.py                    # Servidor principal (MODIFICAR)
├── cv_processor.py              # NUEVO: Procesador de CVs
├── cv_matcher.py                # NUEVO: Matching nombre → matrícula
├── Capital_Intelectual.xlsx     # Certificaciones (existente)
├── Census.xlsx                  # Skills/RRHH (existente)
├── cvs/                         # NUEVO: Carpeta de CVs
│   ├── PACO ALEJANDRO PEREZ GUTIERREZ.pdf
│   ├── MARIA JOSE GARCIA LOPEZ.docx
│   └── ... (~40 CVs)
├── cv_mapping.xlsx              # NUEVO: Mapeo generado (editable)
├── cv_mapping_review.xlsx       # NUEVO: CVs que requieren revisión
└── lancedb_data/
    ├── certificaciones/         # Existente
    ├── skills/                  # Existente
    └── cvs/                     # NUEVO: Índice de chunks de CVs

backend/
├── api/routes/
│   ├── cv.py                    # NUEVO: Endpoint de descarga
│   └── ...
├── core/services/
│   └── mcp_client.py            # MODIFICAR: Agregar método download_cv
└── ...

frontend/
├── components/
│   └── CandidateCard/
│       └── DownloadCVButton.tsx # NUEVO: Botón de descarga
├── lib/
│   └── api.ts                   # MODIFICAR: Agregar downloadCV()
└── ...
```

---

## 🔧 Implementación por Capa

### 1. MCP - Nuevos Archivos y Modificaciones

#### `cv_matcher.py` (NUEVO)

```python
"""
CV Matcher - Vincula CVs con matrículas usando fuzzy matching por nombre.
"""

import re
import unicodedata
from pathlib import Path
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass
import logging

import pandas as pd
from rapidfuzz import fuzz

logger = logging.getLogger(__name__)


@dataclass
class CVMapping:
    """Resultado del matching de un CV."""
    cv_filename: str
    nombre_extraido: str
    matricula: Optional[str]
    nombre_census: Optional[str]
    confianza: float
    estado: str  # "auto", "revisar", "no_encontrado"


class CVMatcher:
    """Vincula CVs con matrículas por nombre."""
    
    THRESHOLD_AUTO = 80      # >= 80%: match automático
    THRESHOLD_REVIEW = 60    # >= 60%: requiere revisión
    
    def __init__(self, df_census: pd.DataFrame):
        self.df_census = df_census
        self._prepare_census_data()
    
    def _prepare_census_data(self):
        """Prepara datos del Census para matching."""
        colaborador_col = self._find_column(["Colaborador", "Nome"])
        matricula_col = self._find_column(["Matrícula", "Matricula"])
        
        if not colaborador_col or not matricula_col:
            raise ValueError("No se encontraron columnas de nombre/matrícula en Census")
        
        # Crear lookup único
        self.lookup = self.df_census[[matricula_col, colaborador_col]].drop_duplicates()
        self.lookup.columns = ["matricula", "nombre"]
        self.lookup["nombre_normalizado"] = self.lookup["nombre"].apply(self._normalize)
    
    def _find_column(self, names: List[str]) -> Optional[str]:
        """Encuentra columna por nombres posibles."""
        for name in names:
            if name in self.df_census.columns:
                return name
            for col in self.df_census.columns:
                if name.lower() in col.lower():
                    return col
        return None
    
    def _normalize(self, name: str) -> str:
        """Normaliza nombre para comparación."""
        if not isinstance(name, str):
            return ""
        
        # Minúsculas
        name = name.lower()
        
        # Remover acentos
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        
        # Solo letras y espacios
        name = re.sub(r'[^a-z\s]', '', name)
        
        # Normalizar espacios
        name = ' '.join(name.split())
        
        return name
    
    def match_single(self, cv_filename: str) -> CVMapping:
        """Encuentra la matrícula para un CV."""
        # Extraer nombre del archivo
        name_from_file = Path(cv_filename).stem
        name_normalized = self._normalize(name_from_file)
        
        best_match = None
        best_score = 0
        best_nombre = None
        
        for _, row in self.lookup.iterrows():
            name_census = row["nombre_normalizado"]
            
            # Múltiples algoritmos
            score_ratio = fuzz.ratio(name_normalized, name_census)
            score_partial = fuzz.partial_ratio(name_normalized, name_census)
            score_token = fuzz.token_sort_ratio(name_normalized, name_census)
            
            # Promedio ponderado
            score = (score_ratio * 0.3 + score_partial * 0.3 + score_token * 0.4)
            
            if score > best_score:
                best_score = score
                best_match = str(row["matricula"])
                best_nombre = row["nombre"]
        
        # Determinar estado
        if best_score >= self.THRESHOLD_AUTO:
            estado = "auto"
        elif best_score >= self.THRESHOLD_REVIEW:
            estado = "revisar"
        else:
            estado = "no_encontrado"
            best_match = None
            best_nombre = None
        
        return CVMapping(
            cv_filename=cv_filename,
            nombre_extraido=name_from_file,
            matricula=best_match,
            nombre_census=best_nombre,
            confianza=round(best_score, 1),
            estado=estado
        )
    
    def match_all(self, cv_folder: Path) -> List[CVMapping]:
        """Procesa todos los CVs de una carpeta."""
        mappings = []
        
        for filepath in cv_folder.iterdir():
            if filepath.suffix.lower() in ['.pdf', '.docx', '.doc']:
                mapping = self.match_single(filepath.name)
                mappings.append(mapping)
                
                status_icon = {"auto": "✅", "revisar": "⚠️", "no_encontrado": "❌"}[mapping.estado]
                logger.info(f"{status_icon} {filepath.name} → {mapping.matricula or 'N/A'} ({mapping.confianza}%)")
        
        return mappings
    
    def export_mapping(self, mappings: List[CVMapping], output_path: Path):
        """Exporta mappings a Excel."""
        data = [{
            "Archivo CV": m.cv_filename,
            "Nombre Extraído": m.nombre_extraido,
            "Matrícula": m.matricula or "",
            "Nombre Census": m.nombre_census or "",
            "Confianza": f"{m.confianza}%",
            "Estado": {"auto": "✅ Auto", "revisar": "⚠️ Revisar", "no_encontrado": "❌ No encontrado"}[m.estado]
        } for m in mappings]
        
        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False)
        logger.info(f"Mapping exportado: {output_path}")
    
    def load_manual_mapping(self, mapping_file: Path) -> Dict[str, str]:
        """Carga mapping manual/corregido desde Excel."""
        if not mapping_file.exists():
            return {}
        
        df = pd.read_excel(mapping_file)
        mapping = {}
        
        for _, row in df.iterrows():
            filename = str(row.get("Archivo CV", "")).strip()
            matricula = str(row.get("Matrícula", "")).strip()
            
            if filename and matricula:
                mapping[filename] = matricula
        
        return mapping
```

#### `cv_processor.py` (NUEVO)

```python
"""
CV Processor - Extrae texto de CVs y los prepara para indexación.
"""

import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass
import logging

import fitz  # PyMuPDF
from docx import Document

logger = logging.getLogger(__name__)


@dataclass
class CVChunk:
    """Fragmento de un CV para indexación."""
    matricula: str
    chunk_id: int
    text: str
    page_num: Optional[int]
    cv_filename: str


class CVProcessor:
    """Procesa CVs y los prepara para búsqueda semántica."""
    
    def __init__(self, cvs_folder: Path, chunk_size: int = 500, overlap: int = 100):
        self.cvs_folder = cvs_folder
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def extract_text_from_pdf(self, filepath: Path) -> List[Tuple[int, str]]:
        """Extrae texto de PDF con número de página."""
        pages = []
        try:
            doc = fitz.open(filepath)
            for page_num, page in enumerate(doc, 1):
                text = page.get_text("text")
                if text.strip():
                    pages.append((page_num, text))
            doc.close()
        except Exception as e:
            logger.error(f"Error procesando PDF {filepath}: {e}")
        return pages
    
    def extract_text_from_docx(self, filepath: Path) -> List[Tuple[int, str]]:
        """Extrae texto de DOCX."""
        try:
            doc = Document(filepath)
            full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            return [(1, full_text)] if full_text else []
        except Exception as e:
            logger.error(f"Error procesando DOCX {filepath}: {e}")
            return []
    
    def chunk_text(self, text: str) -> List[str]:
        """Divide texto en chunks con overlap."""
        text = re.sub(r'\s+', ' ', text).strip()
        
        if len(text) <= self.chunk_size:
            return [text] if text else []
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            # Cortar en punto, salto de línea o espacio
            if end < len(text):
                for sep in ['. ', '\n', ' ']:
                    last_sep = text.rfind(sep, start, end)
                    if last_sep > start:
                        end = last_sep + len(sep)
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - self.overlap
        
        return chunks
    
    def process_cv(self, filepath: Path, matricula: str) -> List[CVChunk]:
        """Procesa un CV y retorna chunks."""
        ext = filepath.suffix.lower()
        
        if ext == '.pdf':
            pages = self.extract_text_from_pdf(filepath)
        elif ext in ['.docx', '.doc']:
            pages = self.extract_text_from_docx(filepath)
        else:
            logger.warning(f"Formato no soportado: {filepath}")
            return []
        
        chunks = []
        chunk_id = 0
        
        for page_num, page_text in pages:
            for chunk_text in self.chunk_text(page_text):
                chunks.append(CVChunk(
                    matricula=matricula,
                    chunk_id=chunk_id,
                    text=chunk_text,
                    page_num=page_num,
                    cv_filename=filepath.name
                ))
                chunk_id += 1
        
        return chunks
    
    def process_all(self, mapping: Dict[str, str]) -> List[CVChunk]:
        """
        Procesa todos los CVs usando el mapping nombre→matrícula.
        
        Args:
            mapping: Dict {filename: matricula}
        """
        all_chunks = []
        
        if not self.cvs_folder.exists():
            logger.warning(f"Carpeta no existe: {self.cvs_folder}")
            return []
        
        for filepath in self.cvs_folder.iterdir():
            if filepath.suffix.lower() not in ['.pdf', '.docx', '.doc']:
                continue
            
            matricula = mapping.get(filepath.name)
            if not matricula:
                logger.warning(f"Sin matrícula para: {filepath.name}")
                continue
            
            logger.info(f"Procesando: {filepath.name} → {matricula}")
            chunks = self.process_cv(filepath, matricula)
            all_chunks.extend(chunks)
            logger.info(f"  → {len(chunks)} chunks")
        
        return all_chunks
```

#### Modificaciones a `server.py`

```python
# ============================================
# NUEVAS CONSTANTES
# ============================================
CV_FOLDER = BASE_DIR / "cvs"
CV_MAPPING_FILE = BASE_DIR / "cv_mapping.xlsx"
TABLE_CVS = "cvs"


# ============================================
# NUEVOS MODELOS
# ============================================
class CVMatch(BaseModel):
    """Match encontrado en el CV."""
    texto: str = Field(..., description="Fragmento del CV")
    pagina: Optional[int] = Field(None, description="Número de página")
    score: float = Field(..., description="Score de similitud")


# MODIFICAR PerfilCompleto - agregar campos:
class PerfilCompleto(BaseModel):
    # ... campos existentes ...
    
    # ⭐ NUEVOS CAMPOS
    cv_matches: List[CVMatch] = Field(default=[], description="Matches en el CV")
    tiene_cv: bool = Field(default=False, description="Si tiene CV disponible")
    cv_filename: Optional[str] = Field(None, description="Nombre del archivo CV")


# ============================================
# NUEVAS VARIABLES GLOBALES
# ============================================
_table_cvs = None
_cv_mapping: Dict[str, str] = {}      # matricula → filename
_cv_mapping_reverse: Dict[str, str] = {}  # filename → matricula


# ============================================
# INICIALIZACIÓN DE CVs
# ============================================
def initialize_cv_index(force_rebuild: bool = False):
    """Indexa los CVs en LanceDB."""
    global _table_cvs, _cv_mapping, _cv_mapping_reverse
    
    from cv_matcher import CVMatcher
    from cv_processor import CVProcessor
    
    if not CV_FOLDER.exists():
        logger.warning(f"Carpeta de CVs no existe: {CV_FOLDER}")
        return
    
    model = get_model()
    existing = _db.table_names()
    
    # Cargar o generar mapping
    df_skills = load_skills_raw()
    matcher = CVMatcher(df_skills)
    
    # Intentar cargar mapping manual primero
    manual_mapping = matcher.load_manual_mapping(CV_MAPPING_FILE)
    
    if manual_mapping:
        logger.info(f"Usando mapping manual: {len(manual_mapping)} CVs")
        filename_to_matricula = manual_mapping
    else:
        # Generar mapping automático
        logger.info("Generando mapping automático...")
        mappings = matcher.match_all(CV_FOLDER)
        
        # Exportar para revisión
        matcher.export_mapping(mappings, BASE_DIR / "cv_mapping_review.xlsx")
        
        # Usar solo los matches automáticos (>= 80%)
        filename_to_matricula = {
            m.cv_filename: m.matricula 
            for m in mappings 
            if m.estado == "auto" and m.matricula
        }
        
        logger.info(f"Matches automáticos: {len(filename_to_matricula)} de {len(mappings)}")
    
    # Crear mapping reverso (matricula → filename)
    _cv_mapping_reverse = filename_to_matricula
    _cv_mapping = {v: k for k, v in filename_to_matricula.items()}
    
    # Reutilizar tabla si existe y no hay rebuild
    if TABLE_CVS in existing and not force_rebuild:
        logger.info(f"Reutilizando tabla {TABLE_CVS}")
        _table_cvs = _db.open_table(TABLE_CVS)
        return
    
    # Procesar CVs
    processor = CVProcessor(CV_FOLDER, chunk_size=500, overlap=100)
    chunks = processor.process_all(filename_to_matricula)
    
    if not chunks:
        logger.warning("No se encontraron CVs para indexar")
        return
    
    # Crear embeddings e indexar
    logger.info(f"Indexando {len(chunks)} chunks...")
    texts = [c.text for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=True)
    
    records = []
    for i, chunk in enumerate(chunks):
        records.append({
            "id": i,
            "matricula": chunk.matricula,
            "chunk_id": chunk.chunk_id,
            "text": chunk.text,
            "page_num": chunk.page_num,
            "cv_filename": chunk.cv_filename,
            "vector": embeddings[i].tolist()
        })
    
    if TABLE_CVS in existing:
        _db.drop_table(TABLE_CVS)
    
    _table_cvs = _db.create_table(TABLE_CVS, records)
    logger.info(f"Indexados {len(records)} chunks de {len(_cv_mapping)} CVs")


# ============================================
# ENDPOINT DE DESCARGA
# ============================================
from fastapi.responses import FileResponse

@app.get("/cvs/download/{matricula}", tags=["CVs"])
async def download_cv(matricula: str):
    """
    Descarga el CV de un colaborador.
    
    Args:
        matricula: Matrícula del colaborador
    
    Returns:
        Archivo PDF/DOCX del CV
    """
    # Buscar filename para esta matrícula
    cv_filename = _cv_mapping.get(matricula)
    
    if not cv_filename:
        raise HTTPException(404, f"No hay CV registrado para matrícula: {matricula}")
    
    cv_path = CV_FOLDER / cv_filename
    
    if not cv_path.exists():
        raise HTTPException(404, f"Archivo no encontrado: {cv_filename}")
    
    # Determinar media type
    ext = cv_path.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword"
    }
    
    return FileResponse(
        path=cv_path,
        filename=cv_filename,
        media_type=media_types.get(ext, "application/octet-stream")
    )


@app.get("/cvs/mapping-review", tags=["CVs"])
async def get_mapping_review():
    """
    Retorna el estado del mapping CV → matrícula.
    
    Útil para revisar qué CVs fueron mapeados automáticamente
    y cuáles requieren revisión manual.
    """
    review_file = BASE_DIR / "cv_mapping_review.xlsx"
    
    if not review_file.exists():
        return {"mensaje": "No hay archivo de revisión. Ejecutar /reindex-cvs primero"}
    
    df = pd.read_excel(review_file)
    
    return {
        "total_cvs": len(df),
        "auto": len(df[df["Estado"].str.contains("Auto", na=False)]),
        "revisar": len(df[df["Estado"].str.contains("Revisar", na=False)]),
        "no_encontrado": len(df[df["Estado"].str.contains("No encontrado", na=False)]),
        "detalle": df.to_dict(orient="records")
    }


@app.post("/reindex-cvs", tags=["CVs"])
async def reindex_cvs():
    """Reindexar CVs (regenera mapping y vectores)."""
    try:
        # Limpiar mapping existente para forzar regeneración
        if CV_MAPPING_FILE.exists():
            CV_MAPPING_FILE.rename(CV_MAPPING_FILE.with_suffix(".xlsx.bak"))
        
        initialize_cv_index(force_rebuild=True)
        
        return {
            "exito": True,
            "mensaje": "CVs reindexados",
            "total_chunks": _table_cvs.count_rows() if _table_cvs else 0,
            "total_cvs_mapeados": len(_cv_mapping),
            "revisar": f"Ver /cvs/mapping-review para CVs que requieren revisión manual"
        }
    except Exception as e:
        logger.error(f"Error reindexando: {e}")
        raise HTTPException(500, str(e))


# ============================================
# MODIFICAR search_and_enrich()
# ============================================
def search_and_enrich(query: str, limit: int = 10, pais: Optional[str] = None,
                      include_cv_search: bool = True) -> List[PerfilCompleto]:
    """
    Busca candidatos con perfiles enriquecidos.
    Ahora incluye búsqueda en CVs.
    """
    # ... código existente para certs y skills ...
    
    # ⭐ NUEVO: Buscar en CVs
    cv_matches_by_matricula: Dict[str, List[CVMatch]] = {}
    
    if include_cv_search and _table_cvs:
        cv_results = _table_cvs.search(query_vector).limit(limit * 5).to_pandas()
        
        for _, row in cv_results.iterrows():
            mat = str(row.get("matricula", "")).strip()
            if not mat:
                continue
            
            dist = float(row.get("_distance", 0))
            score = 100 * math.exp(-dist / 15)
            
            if mat not in cv_matches_by_matricula:
                cv_matches_by_matricula[mat] = []
            
            cv_matches_by_matricula[mat].append(CVMatch(
                texto=row.get("text", "")[:300] + "...",
                pagina=row.get("page_num"),
                score=round(score, 2)
            ))
            
            # Si no existe en certs/skills, agregar
            if mat not in candidatos_raw:
                info = get_basic_info_for_matricula(mat)
                if info:
                    candidatos_raw[mat] = {
                        "matricula": mat,
                        "nombre": info.get("nombre", ""),
                        "email": info.get("email", ""),
                        "cargo": info.get("cargo", ""),
                        "pais": info.get("pais"),
                        "match_principal": f"CV: {row.get('text', '')[:50]}...",
                        "score": score,
                        "source": "cv"
                    }
    
    # ... código existente de ordenamiento ...
    
    # ⭐ NUEVO: Agregar info de CV al perfil
    for perfil in perfiles:
        mat = perfil.matricula
        
        # CV matches
        perfil.cv_matches = sorted(
            cv_matches_by_matricula.get(mat, []),
            key=lambda x: x.score,
            reverse=True
        )[:3]
        
        # Tiene CV?
        perfil.tiene_cv = mat in _cv_mapping
        perfil.cv_filename = _cv_mapping.get(mat)
    
    return perfiles
```

---

### 2. Backend - Endpoint Proxy

#### `backend/api/routes/cv.py` (NUEVO)

```python
"""
Endpoints para descarga de CVs.
Actúa como proxy autenticado hacia el MCP.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from core.config import settings
from core.security import get_current_user
from models.database.user import User

router = APIRouter(prefix="/cvs", tags=["CVs"])


@router.get("/{matricula}/download")
async def download_cv(
    matricula: str,
    current_user: User = Depends(get_current_user)
):
    """
    Descarga el CV de un colaborador.
    
    Requiere autenticación. Actúa como proxy hacia el MCP.
    """
    mcp_url = f"{settings.MCP_TALENT_URL}/cvs/download/{matricula}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(mcp_url)
            
            if response.status_code == 404:
                raise HTTPException(404, "CV no encontrado para esta matrícula")
            
            response.raise_for_status()
            
            # Obtener headers de respuesta
            content_disposition = response.headers.get(
                "content-disposition", 
                f'attachment; filename="CV_{matricula}.pdf"'
            )
            content_type = response.headers.get(
                "content-type", 
                "application/octet-stream"
            )
            
            return StreamingResponse(
                iter([response.content]),
                media_type=content_type,
                headers={"Content-Disposition": content_disposition}
            )
            
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Error comunicando con MCP: {str(e)}")
```

#### Registrar router en `backend/api/routes/__init__.py`

```python
from .cv import router as cv_router

# En la función que registra routers:
app.include_router(cv_router, prefix="/api/v1")
```

#### Actualizar `backend/core/services/mcp_client.py`

```python
class MCPTalentClient:
    # ... métodos existentes ...
    
    async def download_cv(self, matricula: str) -> Optional[bytes]:
        """Descarga el CV de un colaborador."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/cvs/download/{matricula}"
                )
                
                if response.status_code == 404:
                    return None
                
                response.raise_for_status()
                return response.content
                
        except Exception as e:
            logger.error(f"Error descargando CV: {e}")
            return None
    
    async def get_cv_mapping_status(self) -> dict:
        """Obtiene estado del mapping de CVs."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/cvs/mapping-review"
                )
                response.raise_for_status()
                return response.json()
        except Exception:
            return {}
```

---

### 3. Frontend - Botón de Descarga

#### `frontend/lib/api.ts` - Agregar función

```typescript
// Agregar al cliente API existente

export const downloadCV = async (matricula: string): Promise<void> => {
  try {
    const response = await api.get(`/cvs/${matricula}/download`, {
      responseType: 'blob',
    });
    
    // Extraer filename del header si existe
    const contentDisposition = response.headers['content-disposition'];
    let filename = `CV_${matricula}.pdf`;
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }
    
    // Crear link de descarga
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error descargando CV:', error);
    throw error;
  }
};
```

#### Componente de descarga (ejemplo con Ant Design)

```tsx
// frontend/components/DownloadCVButton.tsx

import { Button, Tooltip, message } from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { downloadCV } from '@/lib/api';

interface DownloadCVButtonProps {
  matricula: string;
  tieneCV: boolean;
  cvFilename?: string;
}

export const DownloadCVButton = ({ 
  matricula, 
  tieneCV, 
  cvFilename 
}: DownloadCVButtonProps) => {
  const [loading, setLoading] = useState(false);
  
  if (!tieneCV) {
    return (
      <Tooltip title="Este candidato no tiene CV disponible">
        <Button 
          icon={<FileTextOutlined />} 
          disabled
          size="small"
        >
          Sin CV
        </Button>
      </Tooltip>
    );
  }
  
  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadCV(matricula);
      message.success('CV descargado correctamente');
    } catch (error) {
      message.error('Error al descargar el CV');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Tooltip title={cvFilename || 'Descargar CV'}>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={handleDownload}
        loading={loading}
        size="small"
      >
        Descargar CV
      </Button>
    </Tooltip>
  );
};
```

#### Uso en componente de candidato

```tsx
// En el componente que muestra cada candidato

<CandidateCard>
  <h3>{candidato.nombre}</h3>
  <p>{candidato.cargo}</p>
  
  {/* Mostrar matches del CV si existen */}
  {candidato.cv_matches?.length > 0 && (
    <div className="cv-matches">
      <h4>📄 Encontrado en CV:</h4>
      {candidato.cv_matches.map((match, i) => (
        <p key={i} className="cv-excerpt">
          "{match.texto}" <span>(pág. {match.pagina})</span>
        </p>
      ))}
    </div>
  )}
  
  {/* Botón de descarga */}
  <DownloadCVButton
    matricula={candidato.matricula}
    tieneCV={candidato.tiene_cv}
    cvFilename={candidato.cv_filename}
  />
</CandidateCard>
```

---

## 📦 Dependencias Adicionales

### MCP - `requirements.txt`
```txt
# Procesamiento de CVs
PyMuPDF>=1.23.0         # Extracción de texto de PDFs
python-docx>=1.0.0      # Extracción de texto de DOCX
rapidfuzz>=3.0.0        # Fuzzy matching para nombres
```

### Backend
No requiere dependencias adicionales (usa httpx existente)

### Frontend
No requiere dependencias adicionales (usa axios/fetch existente)

---

## ✅ Checklist de Implementación

### Fase 1: Preparación (1-2 horas)
- [ ] Crear carpeta `mcp/cvs/`
- [ ] Copiar los ~40 CVs a la carpeta
- [ ] Agregar dependencias a `requirements.txt`
- [ ] Verificar que Census.xlsx tenga nombres completos

### Fase 2: MCP (4-5 horas)
- [ ] Crear `cv_matcher.py`
- [ ] Crear `cv_processor.py`
- [ ] Agregar constantes y modelos a `server.py`
- [ ] Implementar `initialize_cv_index()`
- [ ] Agregar endpoint `/cvs/download/{matricula}`
- [ ] Agregar endpoint `/cvs/mapping-review`
- [ ] Agregar endpoint `/reindex-cvs`
- [ ] Modificar `search_and_enrich()` para incluir CVs
- [ ] Modificar `lifespan` para inicializar CVs
- [ ] **Probar localmente**

### Fase 3: Backend (1-2 horas)
- [ ] Crear `api/routes/cv.py`
- [ ] Registrar router
- [ ] Actualizar `mcp_client.py` con método `download_cv`
- [ ] **Probar endpoint proxy**

### Fase 4: Frontend (2-3 horas)
- [ ] Agregar función `downloadCV` a api.ts
- [ ] Crear componente `DownloadCVButton`
- [ ] Integrar en componente de candidatos
- [ ] Mostrar `cv_matches` si existen
- [ ] **Probar flujo completo**

### Fase 5: Revisión de Mapping (1 hora)
- [ ] Ejecutar `/reindex-cvs`
- [ ] Revisar `/cvs/mapping-review`
- [ ] Corregir CVs con estado "Revisar" en `cv_mapping.xlsx`
- [ ] Re-ejecutar `/reindex-cvs` con mapping corregido

### Fase 6: Deploy (1 hora)
- [ ] Actualizar Dockerfile si es necesario
- [ ] Subir CVs a producción
- [ ] Deploy de las 3 capas
- [ ] Verificar en producción

---

## ⏱ Estimación Total

| Capa | Tiempo |
|------|--------|
| MCP | 4-5 horas |
| Backend | 1-2 horas |
| Frontend | 2-3 horas |
| Revisión Mapping | 1 hora |
| Testing E2E | 2 horas |
| Deploy | 1 hora |
| **Total** | **~12-14 horas** |

---

## 🔄 Flujo de Datos Completo

```
Usuario busca: "Java Spring"
         │
         ▼
    ┌─────────┐
    │ Frontend│ POST /api/v1/mcp/search {consulta: "Java Spring"}
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Backend │ Proxy a MCP
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │   MCP   │ search_and_enrich("Java Spring")
    │         │
    │  1. Buscar en certs    → 3 matches
    │  2. Buscar en skills   → 5 matches  
    │  3. Buscar en CVs      → 2 matches (NUEVO)
    │  4. Fusionar + dedup
    │  5. Enriquecer perfiles
    └────┬────┘
         │
         ▼
    Response:
    {
      "candidatos": [{
        "matricula": "12345",
        "nombre": "Paco Pérez",
        "tiene_cv": true,
        "cv_filename": "PACO ALEJANDRO PEREZ.pdf",
        "cv_matches": [
          {"texto": "...5 años Java Spring...", "pagina": 1}
        ]
      }]
    }
         │
         ▼
    ┌─────────┐
    │ Frontend│ Muestra candidato con botón [Descargar CV]
    └────┬────┘
         │
         │ Usuario hace clic en "Descargar CV"
         ▼
    ┌─────────┐
    │ Frontend│ GET /api/v1/cvs/12345/download
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Backend │ Verifica JWT, proxy a MCP
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │   MCP   │ GET /cvs/download/12345
    │         │ Lee archivo: cvs/PACO ALEJANDRO PEREZ.pdf
    │         │ Retorna FileResponse
    └────┬────┘
         │
         ▼
    Browser descarga: PACO ALEJANDRO PEREZ.pdf
```

---

## 📞 Notas Finales

1. **El matching por nombre no es 100% perfecto** - Revisar `cv_mapping_review.xlsx` después del primer reindex

2. **CVs con nombres muy diferentes requerirán mapeo manual** - Editar `cv_mapping.xlsx`

3. **El endpoint de descarga en MCP no tiene autenticación** - El Backend actúa como gateway seguro

4. **Considerar limitar acceso a CVs por rol** - Futuro: solo managers pueden descargar CVs de su equipo

---

**Documento listo para implementación cuando terminen los cambios actuales.**
