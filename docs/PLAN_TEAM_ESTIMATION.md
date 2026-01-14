# Plan de Implementacion: Estimacion de Equipo y Costos con IA

## Resumen Ejecutivo

Este documento detalla el plan para agregar **analisis inteligente de recursos y costos** al sistema RFP Analyzer, incluyendo:

1. **Estimacion de Equipo**: IA analiza el RFP y sugiere equipo necesario
2. **Estimacion de Costos**: Calculo automatico basado en recursos
3. **Integracion con MCP**: Busqueda de candidatos reales en TIVIT

---

## Matriz de Escenarios (2x2)

La IA detecta automaticamente el escenario basado en 2 variables:
- ¿El RFP menciona personal/equipo requerido?
- ¿El RFP muestra presupuesto?

| | **Con Presupuesto** | **Sin Presupuesto** |
|---|---|---|
| **Con Personal** | **A**: Validar viabilidad | **C**: Estimar presupuesto |
| **Sin Personal** | **B**: IA sugiere equipo | **D**: IA sugiere todo |

---

### Escenario A: Personal + Presupuesto (Validar)

**RFP dice:** "Necesito 3 devs Java, presupuesto $15,000/mes, Chile"

**Flujo:**
1. **Grounding**: Buscar "salario dev java chile" -> $5,000-6,500/mes
2. **Calcular**: 3 x $5,500 = $16,500/mes necesarios
3. **Comparar**: $15,000 < $16,500 = INSUFICIENTE (gap -10%)
4. **MCP**: Traer 7-10 devs Java de Chile (mas de los 3 pedidos)
5. **Resultado**: Viabilidad + opciones + candidatos

---

### Escenario B: Sin Personal + Con Presupuesto (IA sugiere equipo)

**RFP dice:** "Proyecto de app movil, presupuesto $50,000/mes, Peru"

**Flujo:**
1. **IA analiza** alcance y estima equipo: PM, Tech Lead, 3 Mobile, 2 Backend, QA, DevOps
2. **Grounding**: Buscar tarifas por rol en Peru
3. **Calcular**: Total = $48,000/mes
4. **Comparar**: $50,000 > $48,000 = VIABLE (margen +4%)
5. **MCP**: Traer candidatos para cada rol (5-10 por rol)
6. **Resultado**: Equipo sugerido + viabilidad + candidatos

---

### Escenario C: Con Personal + Sin Presupuesto (Estimar costo)

**RFP dice:** "Necesitamos 5 ingenieros cloud AWS, Colombia"

**Flujo:**
1. **Grounding**: Buscar "cloud engineer aws salary colombia" -> $6,000-8,000/mes
2. **Calcular base**: 5 x $7,000 = $35,000/mes
3. **Agregar margen** (15-25%): $35,000 x 1.20 = $42,000/mes
4. **MCP**: Traer 10-15 ingenieros cloud de Colombia
5. **Resultado**: Presupuesto sugerido + candidatos

---

### Escenario D: Sin Personal + Sin Presupuesto (IA genera todo)

**RFP dice:** "Sistema de gestion de inventarios para retail, Brasil"

**Flujo:**
1. **IA analiza** alcance y estima equipo: PM, Arquitecto, 4 Devs, 2 QA, DBA
2. **Grounding**: Buscar tarifas por rol en Brasil
3. **Calcular base**: $52,000/mes
4. **Agregar margen** (15-25%): $62,400/mes
5. **MCP**: Traer candidatos para cada rol
6. **Resultado**: Equipo + presupuesto + candidatos

---

## Flujo Unificado (siempre se ejecuta)

```
RFP Llega
    |
    v
Detectar Escenario (A/B/C/D)
    |
    v
+-------------------+
| Si NO hay equipo  |---> IA estima equipo basado en alcance
| definido          |
+-------------------+
    |
    v
GROUNDING: Buscar tarifas de mercado por rol y pais
    |
    v
Calcular costo total del equipo
    |
    v
+-------------------+
| Si NO hay presu.  |---> Generar presupuesto sugerido (+15-25% margen)
| definido          |
+-------------------+
    |
    v
+-------------------+
| Si HAY presu.     |---> Comparar y determinar viabilidad
| definido          |
+-------------------+
    |
    v
MCP: Traer candidatos reales de TIVIT (5-10 por rol)
    |
    v
RESULTADO FINAL:
- Escenario detectado
- Equipo (definido o sugerido)
- Presupuesto (definido o sugerido)
- Viabilidad (si aplica)
- Lista de candidatos TIVIT
```

---

## Arquitectura Propuesta

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|   RFP Document   | --> |   Gemini 2.5 Pro  | --> |  Team Estimation |
|   (PDF/DOCX)     |     |   (Analisis)      |     |  + Cost Analysis |
|                  |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
                                                           |
                                                           v
                         +-------------------+     +------------------+
                         |                   |     |                  |
                         |   MCP Talent      | <-- |  Roles Required  |
                         |   Search Server   |     |  (JSON)          |
                         |                   |     |                  |
                         +-------------------+     +------------------+
                                  |
                                  v
                         +-------------------+
                         |                   |
                         |  Real Candidates  |
                         |  + Contact Info   |
                         |                   |
                         +-------------------+
```

---

## Nuevos Datos a Extraer

### 1. Estimacion de Equipo (team_estimation)

```json
{
  "team_estimation": {
    "source": "client_specified" | "ai_estimated",
    "confidence": 0.85,
    
    "roles": [
      {
        "role_id": "PM_Senior",
        "title": "Project Manager Senior",
        "quantity": 1,
        "seniority": "senior",
        "required_skills": ["PMP", "Scrum Master", "Agile"],
        "required_certifications": ["PMP", "CSM"],
        "dedication": "full_time" | "part_time",
        "duration_months": 12,
        "justification": "Proyecto de alta complejidad requiere PM certificado"
      },
      {
        "role_id": "Dev_Java_Sr",
        "title": "Desarrollador Java Senior",
        "quantity": 3,
        "seniority": "senior",
        "required_skills": ["Java", "Spring Boot", "Microservices", "AWS"],
        "required_certifications": ["AWS Solutions Architect"],
        "dedication": "full_time",
        "duration_months": 12,
        "justification": "Backend complejo con microservicios"
      }
    ],
    
    "team_structure": {
      "total_headcount": 8,
      "organization": "Por celdas/squads",
      "suggested_org_chart": {
        "PM": ["Tech Lead", "QA Lead"],
        "Tech Lead": ["Dev 1", "Dev 2", "Dev 3"],
        "QA Lead": ["QA 1"]
      }
    },
    
    "rationale": "Basado en el alcance de 15 modulos, 18 meses de duracion..."
  }
}
```

### 2. Estimacion de Costos (cost_estimation)

```json
{
  "cost_estimation": {
    "scenario": "A" | "B" | "C" | "D",
    "scenario_description": "Personal definido + Presupuesto definido",
    
    "team_cost": {
      "monthly_base": 27500,
      "currency": "USD",
      "source": "grounding",
      "breakdown": [
        {
          "role": "Dev Java Senior",
          "quantity": 5,
          "market_rate": {
            "min": 4500,
            "max": 6500,
            "average": 5500,
            "source": "Glassdoor Chile, LinkedIn Salary Insights"
          },
          "subtotal": 27500
        }
      ]
    },
    
    "margin": {
      "percent": 20,
      "amount": 5500,
      "note": "Margen operativo estandar TIVIT"
    },
    
    "suggested_budget": {
      "monthly": 33000,
      "duration_months": 12,
      "total": 396000,
      "note": "Solo aplica si cliente NO especifico presupuesto (Escenarios C y D)"
    },
    
    "viability_analysis": {
      "client_budget": 20000,
      "required_budget": 27500,
      "gap": -7500,
      "gap_percent": -27.3,
      "is_viable": false,
      "assessment": "UNDER_BUDGET",
      "recommendations": [
        "Aumentar presupuesto a $28,000/mes minimo",
        "Reducir equipo a 3 ingenieros senior ($16,500/mes)",
        "Considerar 2 senior + 2 mid-level ($20,000/mes)",
        "Proponer proyecto por fases"
      ],
      "note": "Solo aplica si cliente SI especifico presupuesto (Escenarios A y B)"
    }
  }
}
```

### Sobre el Margen de Ganancia

El margen se aplica cuando TIVIT debe **sugerir** un presupuesto (Escenarios C y D):

| Componente | Descripcion |
|------------|-------------|
| **Costo base** | Suma de tarifas de mercado (grounding) |
| **Margen operativo** | 15-25% sobre costo base |
| **Contingencia** | 5-10% para imprevistos (opcional) |

**Formula:**
```
Presupuesto Sugerido = Costo Base x (1 + Margen%)

Ejemplo:
- Costo base: $35,000/mes (5 ingenieros x $7,000)
- Margen 20%: $7,000
- Presupuesto sugerido: $42,000/mes
```

**Nota para BDM:** El margen puede ajustarse segun:
- Competitividad de la licitacion
- Relacion con el cliente
- Complejidad del proyecto
- Riesgos identificados
```

### 3. Equipo Sugerido desde MCP (suggested_team)

```json
{
  "suggested_team": {
    "generated_at": "2026-01-14T10:30:00Z",
    "mcp_server": "talent-search",
    
    "roles": {
      "PM_Senior": {
        "required": 1,
        "candidates_found": 5,
        "candidates": [
          {
            "matricula": "12345",
            "nombre": "Juan Perez",
            "email": "juan.perez@tivit.com",
            "cargo": "Project Manager",
            "score": 0.95,
            "match_reason": "PMP Certified, 8 anos experiencia",
            "certifications": ["PMP", "CSM", "ITIL"],
            "leader": {
              "name": "Maria Jefa",
              "email": "maria.jefa@tivit.com"
            },
            "availability": "to_confirm"
          }
        ]
      }
    },
    
    "summary": {
      "roles_filled": 5,
      "roles_total": 5,
      "coverage_percent": 100,
      "total_candidates": 28
    }
  }
}
```

---

## Opciones de Implementacion

### Opcion 1: Gemini 2.5 Pro con Grounding (Recomendada)

**Ventajas:**
- Gemini tiene acceso a internet via Google Search
- Puede buscar tarifas de mercado actualizadas
- Conoce certificaciones actuales y su valor

**Como activar:**
```python
# En Vertex AI, usar grounding con Google Search
response = client.models.generate_content(
    model="gemini-2.5-pro-preview",
    contents=[pdf_file, prompt],
    config={
        "tools": [{"google_search": {}}],  # Grounding
        "temperature": 0.1,
    }
)
```

**Consideraciones:**
- Costo adicional por uso de grounding
- Latencia ligeramente mayor
- Resultados mas actualizados

### Opcion 2: Gemini 2.5 Flash (Sin internet, mas rapido)

**Ventajas:**
- Mas rapido y barato
- Suficiente para estimaciones basicas
- No depende de internet

**Desventajas:**
- Tarifas basadas en conocimiento de entrenamiento
- Puede estar desactualizado

### Opcion 3: Hibrido (Recomendada para produccion)

**Flujo:**
1. Gemini Flash hace analisis inicial del RFP (rapido)
2. Gemini Pro con grounding hace estimacion de costos (preciso)
3. MCP trae candidatos reales (datos internos)

---

## Integracion con MCP

### Estado Actual del MCP

**El MCP Server YA EXISTE y esta 100% funcional.** No requiere modificaciones.

| Componente | Estado | Ubicacion |
|------------|--------|-----------|
| MCP Server | ✅ Existe | `mcp/server.py` |
| Endpoint `/batch-search` | ✅ Existe | Puerto 8083 |
| Endpoint `/search` | ✅ Existe | Puerto 8083 |
| Endpoint `/chat` | ✅ Existe | Puerto 8083 |
| Base vectorial LanceDB | ✅ Existe | `mcp/lancedb_data/` |
| Datos RRHH | ✅ Existe | `mcp/Census.xlsx` |
| Datos Certificaciones | ✅ Existe | `mcp/Capital_Intelectual.xlsx` |

### Endpoint MCP que usaremos: POST /batch-search

**Request:**
```json
{
  "roles": [
    {
      "rol_id": "Dev_Java_Sr",
      "descripcion": "Java Spring Boot Microservicios AWS",
      "pais": "Chile",
      "cantidad": 7
    },
    {
      "rol_id": "PM_Senior",
      "descripcion": "Project Manager PMP Scrum Agile",
      "pais": "Chile",
      "cantidad": 5
    }
  ]
}
```

**Response:**
```json
{
  "exito": true,
  "mensaje": "Busqueda completada: 2 roles, 12 candidatos",
  "resultados": {
    "Dev_Java_Sr": {
      "rol_id": "Dev_Java_Sr",
      "descripcion": "Java Spring Boot Microservicios AWS",
      "candidatos": [
        {
          "matricula": "12345",
          "nombre": "Juan Pérez",
          "email": "juan.perez@tivit.com",
          "cargo": "Desarrollador Senior",
          "pais": "Chile",
          "certificaciones": [
            {"nombre": "AWS Solutions Architect", "institucion": "Amazon"}
          ],
          "skills": [
            {"nombre": "Java", "proficiencia": 5},
            {"nombre": "Spring Boot", "proficiencia": 4}
          ],
          "lider": {
            "nombre": "María Jefa",
            "email": "maria.jefa@tivit.com"
          },
          "match_principal": "Java Spring Boot",
          "score": 0.95
        }
      ],
      "total": 7
    }
  },
  "total_roles": 2,
  "total_candidatos": 12
}
```

### Flujo de Conexion

```
Backend (FastAPI)
      |
      | POST /api/v1/rfp/{id}/suggest-team
      v
+---------------------+
|  RFPAnalyzer        |
|  Service            |
+---------------------+
      |
      | 1. Obtiene team_estimation del RFP
      v
+---------------------+
|  MCPTalentClient    |  <-- NUEVO (por crear)
|  (httpx)            |
+---------------------+
      |
      | POST http://localhost:8083/batch-search
      v
+---------------------+
|  MCP Talent Server  |  <-- YA EXISTE
|  (mcp/server.py)    |
+---------------------+
      |
      | LanceDB + Excel RRHH
      v
+---------------------+
|  Candidatos Reales  |
|  de TIVIT           |
+---------------------+
```

### Lo que necesitamos CREAR en Backend

**1. Cliente MCP (nuevo archivo):**
```python
# backend/core/services/mcp_client.py

import httpx
from core.config import settings

class MCPTalentClient:
    """Cliente para conectar con MCP Talent Search Server."""
    
    def __init__(self):
        self.base_url = settings.MCP_TALENT_URL  # http://localhost:8083
    
    async def search_team(self, roles: list[dict]) -> dict:
        """Llama a POST /batch-search del MCP."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/batch-search",
                json={"roles": roles}
            )
            response.raise_for_status()
            return response.json()
    
    async def health_check(self) -> bool:
        """Verifica si MCP esta disponible."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except:
            return False
```

**2. Funcion de conversion (en analyzer.py):**
```python
def convert_to_mcp_roles(team_estimation: dict, country: str) -> list[dict]:
    """Convierte team_estimation de Gemini a formato MCP."""
    mcp_roles = []
    
    for role in team_estimation.get("roles", []):
        # Construir descripcion con skills y certificaciones
        descripcion_parts = role.get("required_skills", [])
        descripcion_parts += role.get("required_certifications", [])
        descripcion_parts.append(role.get("title", ""))
        
        mcp_roles.append({
            "rol_id": role["role_id"],
            "descripcion": " ".join(descripcion_parts),
            "pais": country,
            "cantidad": max(role.get("quantity", 1) * 2, 5)  # Minimo 5, o el doble
        })
    
    return mcp_roles
```

**3. Endpoint nuevo (en rfp.py):**
```python
@router.post("/{rfp_id}/suggest-team")
async def suggest_team(
    rfp_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sugiere equipo real basado en el analisis del RFP.
    Conecta con MCP para traer candidatos de TIVIT.
    """
    # 1. Obtener RFP
    rfp = db.query(RFPSubmission).filter_by(id=rfp_id).first()
    if not rfp:
        raise HTTPException(404, "RFP no encontrado")
    
    # 2. Obtener team_estimation (del analisis previo)
    team_estimation = rfp.extracted_data.get("team_estimation")
    country = rfp.extracted_data.get("country", rfp.country)
    
    if not team_estimation:
        raise HTTPException(400, "RFP no tiene estimacion de equipo")
    
    # 3. Convertir a formato MCP
    mcp_roles = convert_to_mcp_roles(team_estimation, country)
    
    # 4. Llamar a MCP
    mcp_client = MCPTalentClient()
    mcp_results = await mcp_client.search_team(mcp_roles)
    
    # 5. Guardar en extracted_data
    rfp.extracted_data["suggested_team"] = mcp_results
    rfp.updated_at = datetime.utcnow()
    db.commit()
    
    return mcp_results
```

**4. Variable de entorno:**
```bash
# .env
MCP_TALENT_URL=http://localhost:8083
```

---

## Prompt para Estimacion de Equipo

```
Eres un experto en estimacion de proyectos de software para TIVIT.

Analiza el RFP y genera una estimacion de equipo considerando:

1. ALCANCE: Cuantos modulos/features se piden
2. TECNOLOGIA: Stack requerido y su complejidad
3. PLAZOS: Duracion del proyecto y deadlines
4. CALIDAD: SLAs y penalidades que requieren mas QA
5. RIESGOS: Tecnologias nuevas que requieren especialistas

REGLAS:
- Si el cliente especifica equipo, expande con 5-7 opciones por rol
- Si NO especifica, estima basandote en el alcance
- Siempre incluir: PM, Tech Lead, Desarrolladores, QA
- Para proyectos > 6 meses, considerar DevOps
- Para proyectos con IA, incluir ML Engineer / Data Scientist

TARIFAS DE REFERENCIA (USD/mes):
- PM Senior: $6,000 - $10,000
- Tech Lead: $7,000 - $12,000
- Dev Senior: $5,000 - $8,000
- Dev Mid: $3,500 - $5,500
- QA Senior: $4,000 - $6,000
- DevOps: $6,000 - $9,000
- ML Engineer: $8,000 - $15,000

Responde SOLO con JSON valido.
```

---

## Cambios en Base de Datos

### Nuevas columnas en rfp_submissions

```sql
-- No necesitamos columnas nuevas!
-- Todo va en extracted_data (JSONB)

-- Solo agregar indice si queremos buscar por costo estimado
CREATE INDEX idx_rfp_cost ON rfp_submissions (
    (extracted_data->'cost_estimation'->>'total_estimated')::numeric
);
```

---

## Cambios en Frontend

### Nueva seccion en RFPDetailPage

```
+--------------------------------------------------+
|  ANALISIS DE RFP                                 |
+--------------------------------------------------+
|  [Tabs: Resumen | Equipo | Costos | Candidatos]  |
+--------------------------------------------------+

Tab "Equipo":
+--------------------------------------------------+
|  Equipo Estimado                                 |
|  Fuente: [Especificado por cliente / Estimado IA]|
|                                                  |
|  +--------------------------------------------+  |
|  | Rol              | Qty | Seniority | Skills | |
|  |--------------------------------------------|  |
|  | Project Manager  |  1  | Senior    | PMP... | |
|  | Dev Java         |  3  | Senior    | Java...| |
|  | QA Lead          |  1  | Senior    | Auto...| |
|  +--------------------------------------------+  |
|                                                  |
|  [Buscar Candidatos en TIVIT]  <-- Llama a MCP  |
+--------------------------------------------------+

Tab "Costos":
+--------------------------------------------------+
|  Estimacion de Costos                            |
|                                                  |
|  Costo Mensual Equipo:     $85,000 USD          |
|  Duracion:                 18 meses              |
|  Costo Total Equipo:       $1,530,000 USD       |
|  + Infraestructura:        $50,000              |
|  + Licencias:              $25,000              |
|  + Contingencia (15%):     $242,250             |
|  ----------------------------------------       |
|  TOTAL ESTIMADO:           $1,857,250 USD       |
|                                                  |
|  Presupuesto Cliente:      $500K - $750K        |
|  Estado:                   [!] SOBRE PRESUPUESTO |
|  Gap:                      $1.1M (147%)         |
|                                                  |
|  Recomendacion IA:                              |
|  "Negociar reduccion de alcance o proponer      |
|   implementacion por fases..."                  |
+--------------------------------------------------+

Tab "Candidatos":
+--------------------------------------------------+
|  Equipo Sugerido (desde TIVIT)                  |
|                                                  |
|  PM Senior (1 requerido - 5 encontrados)        |
|  +--------------------------------------------+ |
|  | * Juan Perez (95% match)                   | |
|  |   PMP, CSM, ITIL | juan@tivit.com          | |
|  |   Lider: Maria Jefa                        | |
|  |                                            | |
|  | * Ana Garcia (92% match)                   | |
|  |   PMP, PSM | ana@tivit.com                 | |
|  +--------------------------------------------+ |
|                                                  |
|  [Exportar Equipo]  [Contactar Lideres]         |
+--------------------------------------------------+
```

---

## Fases de Implementacion

### Fase 1: Estimacion de Equipo (3-4 dias)

| # | Tarea | Prioridad |
|---|-------|-----------|
| 1.1 | Actualizar prompt de analisis para incluir team_estimation | Alta |
| 1.2 | Agregar cost_estimation al schema JSON | Alta |
| 1.3 | Probar con 3-5 RFPs reales | Alta |
| 1.4 | Ajustar prompt segun resultados | Media |

### Fase 2: Integracion MCP (2-3 dias)

| # | Tarea | Prioridad |
|---|-------|-----------|
| 2.1 | Crear MCPClient en backend | Alta |
| 2.2 | Endpoint POST /rfp/{id}/suggest-team | Alta |
| 2.3 | Mapear team_estimation -> MCP batch-search | Alta |
| 2.4 | Guardar suggested_team en extracted_data | Media |

### Fase 3: Frontend (2-3 dias)

| # | Tarea | Prioridad |
|---|-------|-----------|
| 3.1 | Tabs en RFPDetailPage | Alta |
| 3.2 | Componente TeamEstimationView | Alta |
| 3.3 | Componente CostEstimationView | Alta |
| 3.4 | Componente SuggestedTeamView | Alta |
| 3.5 | Boton "Buscar Candidatos" + loading | Media |

### Fase 4: Grounding (Opcional, 1-2 dias)

| # | Tarea | Prioridad |
|---|-------|-----------|
| 4.1 | Habilitar Google Search en Vertex AI | Baja |
| 4.2 | Probar estimaciones con datos actuales | Baja |
| 4.3 | Comparar precision vs sin grounding | Baja |

---

## Consideraciones de Seguridad

1. **MCP Server**: Solo accesible desde backend (localhost o VPC)
2. **Datos RRHH**: No exponer salarios ni datos sensibles al frontend
3. **Logs**: No loguear emails ni datos personales
4. **Rate Limiting**: Limitar llamadas a MCP (1/segundo)

---

## Metricas de Exito

| Metrica | Target |
|---------|--------|
| Precision estimacion equipo | > 80% vs equipo real |
| Tiempo de respuesta | < 30 segundos |
| Cobertura de roles (MCP) | > 70% roles con candidatos |
| Satisfaccion usuario | > 4/5 estrellas |

---

## Decisiones Tomadas

| Decision | Valor |
|----------|-------|
| **Modelo IA** | `gemini-2.0-flash` (soporta grounding) |
| **Grounding** | **SI - Obligatorio** (no hay tabla interna de tarifas) |
| **Fases** | Todas (1, 2, 3, 4) |

### Por que Grounding es Obligatorio

TIVIT no tiene una tabla de tarifas por rol/pais, por lo tanto:
- Gemini usara Google Search para obtener tarifas de mercado actuales
- Buscara automaticamente: "salario [rol] [pais] 2026 USD"
- Comparara con el presupuesto del cliente
- Determinara si es factible o no

**Ejemplo de analisis:**
```
RFP: "5 ingenieros Java, Chile, presupuesto $20k/mes"

Gemini + Grounding:
1. Busca "software engineer java salary chile usd monthly"
2. Encuentra: $4,500 - $6,500/mes promedio
3. Calcula: 5 x $5,500 = $27,500/mes necesarios
4. Compara: $20k < $27,500 = INSUFICIENTE
5. Recomienda: "Aumentar presupuesto o reducir equipo"
```

---

## Resumen de Componentes

### Ya Existen (no modificar)

| Componente | Archivo | Descripcion |
|------------|---------|-------------|
| MCP Server | `mcp/server.py` | API de busqueda de talento |
| MCP /batch-search | `mcp/server.py:939` | Busqueda por multiples roles |
| MCP /search | `mcp/server.py:917` | Busqueda simple |
| MCP /chat | `mcp/server.py:963` | Chat con Gemini |
| LanceDB | `mcp/lancedb_data/` | Base vectorial |
| Datos RRHH | `mcp/Census.xlsx` | Info de colaboradores |
| Datos Certs | `mcp/Capital_Intelectual.xlsx` | Certificaciones |
| Backend base | `backend/` | API FastAPI |
| Gemini Client | `backend/core/gcp/gemini_client.py` | Cliente Gemini |
| RFP Analyzer | `backend/core/services/analyzer.py` | Analisis de RFPs |

### Por Crear

| Componente | Archivo | Descripcion |
|------------|---------|-------------|
| MCP Client | `backend/core/services/mcp_client.py` | Conexion Backend -> MCP |
| Endpoint suggest-team | `backend/api/routes/rfp.py` | Nuevo endpoint |
| Prompt con grounding | `backend/prompts/rfp_analysis.txt` | Prompt actualizado |
| Schemas nuevos | `backend/models/schemas/rfp_schemas.py` | TeamEstimation, CostEstimation |
| Tab Equipo (Frontend) | `frontend/src/components/rfp/TeamEstimationView.tsx` | Vista de equipo |
| Tab Costos (Frontend) | `frontend/src/components/rfp/CostEstimationView.tsx` | Vista de costos |
| Tab Candidatos (Frontend) | `frontend/src/components/rfp/SuggestedTeamView.tsx` | Vista de candidatos |
| Variable MCP_TALENT_URL | `.env` | URL del MCP |

---

## Plan de Ejecucion Detallado

### FASE 1: Backend - Estimacion de Equipo y Costos

**Archivos a modificar:**

1. `backend/core/services/analyzer.py`
   - Agregar metodo `estimate_team_and_costs()`
   - Actualizar prompt con nuevo schema

2. `backend/prompts/rfp_analysis.txt` (crear si no existe)
   - Prompt completo con team_estimation y cost_estimation

3. `backend/models/schemas/rfp_schemas.py`
   - Agregar schemas Pydantic para validacion

**Nuevo schema de respuesta:**
```python
class RoleEstimation(BaseModel):
    role_id: str
    title: str
    quantity: int
    seniority: Literal["junior", "mid", "senior", "lead"]
    required_skills: list[str]
    required_certifications: list[str]
    dedication: Literal["full_time", "part_time"]
    duration_months: int
    justification: str

class TeamEstimation(BaseModel):
    source: Literal["client_specified", "ai_estimated"]
    confidence: float
    roles: list[RoleEstimation]
    total_headcount: int
    rationale: str

class CostEstimation(BaseModel):
    monthly_total: float
    currency: str
    duration_months: int
    total_team_cost: float
    total_with_contingency: float
    comparison: dict  # vs client budget
```

---

### FASE 2: Backend - Integracion MCP

**Archivos a crear:**

1. `backend/core/services/mcp_client.py`
   ```python
   class MCPTalentClient:
       def __init__(self, base_url: str = "http://localhost:8083"):
           self.base_url = base_url
       
       async def search_team(self, roles: list[dict]) -> dict:
           async with httpx.AsyncClient() as client:
               response = await client.post(
                   f"{self.base_url}/batch-search",
                   json={"roles": roles},
                   timeout=60.0
               )
               return response.json()
   ```

2. `backend/api/routes/rfp.py` - Nuevo endpoint
   ```python
   @router.post("/{rfp_id}/suggest-team")
   async def suggest_team(rfp_id: UUID, ...):
       # 1. Obtener team_estimation
       # 2. Convertir a formato MCP
       # 3. Llamar a MCP
       # 4. Guardar y retornar
   ```

**Configuracion:**
- Variable de entorno: `MCP_TALENT_URL=http://localhost:8083`
- Timeout: 60 segundos (batch search puede tardar)

---

### FASE 3: Frontend - Nuevas Vistas

**Archivos a crear/modificar:**

1. `frontend/src/pages/RFPDetailPage.tsx`
   - Agregar tabs: Resumen | Equipo | Costos | Candidatos

2. `frontend/src/components/rfp/TeamEstimationView.tsx`
   - Tabla de roles estimados
   - Indicador: "Especificado por cliente" vs "Estimado por IA"
   - Boton: "Buscar Candidatos"

3. `frontend/src/components/rfp/CostEstimationView.tsx`
   - Desglose de costos
   - Comparacion con presupuesto cliente
   - Alertas visuales (sobre/bajo presupuesto)

4. `frontend/src/components/rfp/SuggestedTeamView.tsx`
   - Lista de candidatos por rol
   - Score de match
   - Info de contacto y lider
   - Acciones: Exportar, Contactar

5. `frontend/src/lib/api.ts`
   - Agregar: `suggestTeam(rfpId: string)`

---

### FASE 4: Testing y Polish

1. Probar con 3-5 RFPs reales
2. Ajustar prompts segun resultados
3. Mejorar UI/UX basado en feedback
4. Documentar API

---

## Orden de Implementacion

```
Dia 1-2: Fase 1 (Prompts + Backend)
   |
   v
Dia 3: Fase 2 (MCP Client)
   |
   v
Dia 4-5: Fase 3 (Frontend)
   |
   v
Dia 6: Fase 4 (Testing)
```

---

## Dependencias Nuevas

**Backend:**
- `httpx` (ya instalado) - para llamadas a MCP

**Frontend:**
- Ninguna nueva

---

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|--------|------------|
| MCP server no disponible | Fallback: mostrar solo estimacion sin candidatos |
| Gemini da formato incorrecto | Validacion Pydantic + retry con prompt corregido |
| Candidatos no encontrados | Mostrar mensaje y sugerir ajustar criterios |

---

## Siguiente Paso

Comenzar implementacion de **Fase 1**: Actualizar prompts y backend para estimacion de equipo y costos.
