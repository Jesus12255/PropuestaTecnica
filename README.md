# TIVIT Proposals v2

Sistema integral de analisis de RFPs (Request for Proposals) y Team Building automatizado usando **Gemini AI**.

## Modulos del Sistema

| Modulo | Descripcion | Puerto |
|--------|-------------|--------|
| **Frontend** | Interfaz web React para gestion de RFPs | 5173 |
| **Backend** | API REST para analisis de documentos | 8000 |
| **MCP Talent Search** | API de busqueda semantica de talento | 8083 |

---

## Funcionalidades Principales

### 1. Analisis de RFPs con IA

- **Extraccion automatica**: Cliente, pais, presupuesto, deadlines, stack tecnologico
- **Recomendacion GO/NO GO**: IA recomienda basado en riesgos, SLAs, penalidades
- **Generacion de preguntas**: Preguntas clave para aclarar antes de proponer

### 2. Estimacion de Equipo y Costos (NUEVO)

Sistema inteligente que analiza el RFP y estima recursos necesarios con **4 escenarios automaticos**:

| Escenario | Input | IA Hace |
|-----------|-------|---------|
| **A** | Personal + Presupuesto | Valida si presupuesto es viable |
| **B** | Sin Personal + Presupuesto | Sugiere equipo optimo dentro del presupuesto |
| **C** | Personal + Sin Presupuesto | Estima presupuesto necesario |
| **D** | Sin Personal + Sin Presupuesto | Sugiere equipo Y presupuesto completo |

**Caracteristicas:**
- **Google Search Grounding**: Tarifas de mercado en tiempo real
- **Estimacion por rol**: PM, Tech Lead, Developers, QA, DevOps, etc.
- **Viabilidad automatica**: Compara presupuesto requerido vs disponible
- **Integracion MCP**: Busca candidatos reales de TIVIT

### 3. Busqueda de Talento (MCP)

- **Busqueda semantica**: Encuentra candidatos por skills y certificaciones
- **Perfiles enriquecidos**: Todas las certificaciones y skills del candidato
- **Chat natural**: Consultas en lenguaje natural con Gemini
- **Batch search**: Equipos completos en una sola llamada

---

## Stack Tecnologico

### Core Application
- **Frontend**: React 19 + Vite + Ant Design (Dark Theme: Negro/Rojo)
- **Backend**: FastAPI + Python 3.12
- **Database**: PostgreSQL 16
- **AI**: Google Gemini 2.0 Flash (con Google Search Grounding)
- **Container**: Docker + Docker Compose

### MCP Talent Search
- **API**: FastAPI + MCP Protocol
- **Vector Store**: LanceDB
- **Embeddings**: sentence-transformers (multilingual)
- **AI**: Gemini 2.5 Flash (chat natural)

---

## Inicio Rapido

### 1. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar y agregar tu GOOGLE_API_KEY
# Obtener desde: https://aistudio.google.com/app/apikey
```

### 2. Iniciar con Docker Compose

```bash
# Iniciar todos los servicios (incluyendo MCP)
docker-compose up --build

# O en background
docker-compose up --build -d

# Ver logs
docker-compose logs -f

# Ver logs de un servicio especifico
docker-compose logs -f mcp
```

> **Nota:** El servicio MCP requiere los archivos Excel de datos (`Capital_Intelectual.xlsx` y `Census.xlsx`) en la carpeta `mcp/`.

### 3. Acceder a la Aplicacion

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| MCP Talent Search | http://localhost:8083 |
| MCP Docs (Swagger) | http://localhost:8083/docs |
| PgAdmin (opcional) | http://localhost:5050 |

---

## Estructura del Proyecto

```
v2/
├── docker-compose.yml      # Orquestacion Docker (4 servicios)
├── .env.example            # Variables de entorno
├── README.md               # Este archivo
│
├── docs/                   # Documentacion
│   ├── PLAN_TEAM_ESTIMATION.md    # Plan de estimacion de equipo
│   ├── FLOW_TEAM_ESTIMATION.md    # Flujo completo con diagramas
│   └── RFP_DATA_EXTRACTION.md     # Datos extraidos del RFP
│
├── frontend/               # React + Vite
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/          # LoginPage, DashboardPage, RFPDetailPage
│       ├── components/     # StatsCards, RFPTable
│       │   └── rfp/        # TeamEstimationView, CostEstimationView, SuggestedTeamView
│       ├── context/        # AuthContext
│       └── lib/            # API client
│
├── backend/                # FastAPI - Analisis RFP
│   ├── Dockerfile
│   ├── main.py
│   ├── api/routes/         # auth, rfp, dashboard
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── services/
│   │   │   ├── analyzer.py     # Analizador de RFPs
│   │   │   └── mcp_client.py   # Cliente para MCP Talent Search
│   │   └── gcp/
│   │       └── gemini_client.py  # Gemini client con grounding
│   ├── models/             # SQLAlchemy models
│   └── prompts/            # Prompts de IA
│       └── rfp_analysis.txt    # Prompt con 4 escenarios
│
└── mcp/                    # MCP Talent Search API
    ├── Dockerfile          # Docker production build
    ├── server.py           # Servidor principal
    ├── requirements.txt    # Dependencias Python
    ├── Capital_Intelectual.xlsx  # Datos de certificaciones
    ├── Census.xlsx         # Datos de RRHH/Skills
    ├── docs/
    │   └── docs.md         # Documentacion tecnica completa
    └── README.md           # Documentacion del modulo
```

---

## Endpoints Principales

### Auth
- `POST /api/v1/auth/register` - Registro
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Usuario actual

### RFP
- `POST /api/v1/rfp/upload` - Subir RFP (inicia analisis automatico)
- `GET /api/v1/rfp` - Listar RFPs
- `GET /api/v1/rfp/{id}` - Detalle RFP con estimaciones
- `POST /api/v1/rfp/{id}/decision` - GO/NO GO
- `GET /api/v1/rfp/{id}/questions` - Preguntas generadas

### Team Estimation (NUEVO)
- `POST /api/v1/rfp/{id}/suggest-team` - Buscar candidatos en MCP
- `GET /api/v1/rfp/{id}/team-estimation` - Obtener estimaciones guardadas

### Dashboard
- `GET /api/v1/dashboard/stats` - Estadisticas
- `GET /api/v1/dashboard/api-consumption` - Consumo Gemini

### MCP Talent Search
- `POST /search` - Busqueda simple
- `POST /batch-search` - Busqueda por roles
- `POST /chat` - Lenguaje natural (Gemini)
- `GET /health` - Estado del servicio

---

## Flujo de Estimacion de Equipo

```
                    +-----------------+
                    |    RFP Upload   |
                    +-----------------+
                            |
                            v
                    +-----------------+
                    | Gemini Analiza  |
                    | (con Grounding) |
                    +-----------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
     +----------+    +----------+    +----------+
     |Personal? |    |Presupuesto|   |Detectar  |
     |Si/No     |    |Si/No      |   |Escenario |
     +----------+    +----------+    +----------+
                            |
                            v
            +-------------------------------+
            |     Escenario A/B/C/D         |
            +-------------------------------+
            | A: Validar viabilidad         |
            | B: Sugerir equipo optimo      |
            | C: Estimar presupuesto        |
            | D: Sugerir equipo + presupuesto|
            +-------------------------------+
                            |
                            v
            +-------------------------------+
            |    Google Search Grounding    |
            |  (Tarifas de mercado actuales)|
            +-------------------------------+
                            |
                            v
            +-------------------------------+
            |    team_estimation JSON       |
            |    cost_estimation JSON       |
            +-------------------------------+
                            |
          Usuario hace clic en
          "Buscar Candidatos"
                            |
                            v
            +-------------------------------+
            |     MCP Talent Search         |
            |     POST /batch-search        |
            +-------------------------------+
                            |
                            v
            +-------------------------------+
            |   Candidatos Reales TIVIT     |
            |   con score, contacto, lider  |
            +-------------------------------+
```

---

## Desarrollo Local

### Frontend (sin Docker)

```bash
cd frontend
npm install
npm run dev
```

### Backend (sin Docker)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### MCP Talent Search

```bash
cd mcp
pip install -r requirements.txt
python server.py
```

---

## Variables de Entorno

```bash
# .env
GOOGLE_API_KEY=tu_api_key_de_google

# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/rfp_db
GEMINI_MODEL=gemini-2.0-flash

# MCP
MCP_TALENT_URL=http://localhost:8083
MCP_GEMINI_MODEL=gemini-2.5-flash-preview-05-20
```

---

## Monitoreo de Consumo de API

El sistema incluye un logger de consumo de Gemini AI:

```bash
# Ver consumo en los logs
docker-compose logs backend | grep "GEMINI API CONSUMPTION"

# O via API
curl http://localhost:8000/api/v1/dashboard/api-consumption
```

### Metricas Disponibles

- Total de requests
- Input/Output tokens
- Thinking tokens (para modelos con thinking mode)
- Latencia promedio
- Tasa de exito/error

---

## Tema Visual

**Dark Mode Premium** con colores TIVIT:

- Fondo principal: `#0A0A0B`
- Cards: `#141416`
- Rojo primario: `#E31837`
- Rojo hover: `#FF2D4D`

---

## Comandos Utiles

```bash
# Reiniciar solo un servicio
docker-compose restart backend
docker-compose restart mcp

# Ver logs de un servicio especifico
docker-compose logs -f backend
docker-compose logs -f mcp

# Ejecutar migraciones (si Alembic esta configurado)
docker-compose exec backend alembic upgrade head

# Acceder al contenedor
docker-compose exec backend bash
docker-compose exec mcp bash

# Reconstruir indices vectoriales del MCP
curl -X POST http://localhost:8083/reindex

# Limpiar todo (incluyendo volumenes)
docker-compose down -v
```

---

## Documentacion Adicional

| Documento | Descripcion |
|-----------|-------------|
| [FLOW_TEAM_ESTIMATION.md](docs/FLOW_TEAM_ESTIMATION.md) | Flujo completo con diagramas |
| [PLAN_TEAM_ESTIMATION.md](docs/PLAN_TEAM_ESTIMATION.md) | Plan de implementacion detallado |
| [MCP Docs](mcp/docs/docs.md) | Documentacion tecnica del MCP |

---

## Licencia

Proyecto privado para TIVIT.
