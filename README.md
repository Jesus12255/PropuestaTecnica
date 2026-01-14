# TIVIT Proposals v2

Sistema integral de análisis de RFPs (Request for Proposals) y Team Building automatizado usando **Gemini AI**.

## Módulos del Sistema

| Módulo | Descripción | Puerto |
|--------|-------------|--------|
| **Frontend** | Interfaz web React para gestión de RFPs | 5173 |
| **Backend** | API REST para análisis de documentos | 8000 |
| **MCP Talent Search** | API de búsqueda semántica de talento | 8083 |

---

## Stack Tecnológico

### Core Application
- **Frontend**: React 19 + Vite + Ant Design (Dark Theme: Negro/Rojo)
- **Backend**: FastAPI + Python 3.12
- **Database**: PostgreSQL 16
- **AI**: Google Gemini 2.0 Flash Thinking
- **Container**: Docker + Docker Compose

### MCP Talent Search
- **API**: FastAPI + MCP Protocol
- **Vector Store**: LanceDB
- **Embeddings**: sentence-transformers (multilingual)
- **AI**: Gemini 2.5 Flash (chat natural)

---

## Inicio Rápido

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

# Ver logs de un servicio específico
docker-compose logs -f mcp
```

> **Nota:** El servicio MCP requiere los archivos Excel de datos (`Capital_Intelectual.xlsx` y `Census.xlsx`) en la carpeta `mcp/`.

### 3. Acceder a la Aplicación

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
├── docker-compose.yml      # Orquestación Docker (4 servicios)
├── .env.example            # Variables de entorno
├── README.md               # Este archivo
│
├── frontend/               # React + Vite
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/          # LoginPage, DashboardPage, etc.
│       ├── components/     # StatsCards, RFPTable, etc.
│       ├── context/        # AuthContext
│       └── lib/            # API client
│
├── backend/                # FastAPI - Análisis RFP
│   ├── Dockerfile
│   ├── main.py
│   ├── api/routes/         # auth, rfp, dashboard
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── gcp/
│   │       └── vertex_ai.py  # Gemini client + Logger
│   └── models/             # SQLAlchemy models
│
└── mcp/                    # MCP Talent Search API
    ├── Dockerfile          # Docker production build
    ├── server.py           # Servidor principal
    ├── requirements.txt    # Dependencias Python
    ├── Capital_Intelectual.xlsx  # Datos de certificaciones
    ├── Census.xlsx         # Datos de RRHH/Skills
    ├── docs/
    │   └── docs.md         # Documentación técnica completa
    ├── tests/              # Tests de la API
    └── README.md           # Documentación del módulo
```

---

## Módulo MCP Talent Search

Sistema de búsqueda semántica de talento para Team Building automatizado.

### Características

- **Perfiles Enriquecidos**: Retorna TODAS las certificaciones y skills de cada candidato
- **Búsqueda Semántica**: Encuentra matches por significado usando embeddings multilingües
- **Chat Natural (Gemini)**: Interpreta consultas en lenguaje natural
- **Batch Search**: Busca equipos completos para múltiples roles

### Endpoints Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/search` | POST | Búsqueda simple |
| `/batch-search` | POST | Búsqueda por roles |
| `/chat` | POST | Lenguaje natural (Gemini) |
| `/health` | GET | Estado del servicio |

### Ejemplo de Uso

```bash
# Búsqueda simple
curl -X POST http://localhost:8083/search \
  -H "Content-Type: application/json" \
  -d '{"consulta": "Java Spring Boot", "limit": 5}'

# Chat natural
curl -X POST http://localhost:8083/chat \
  -H "Content-Type: application/json" \
  -d '{"mensaje": "Necesito 3 desarrolladores Python para Brasil"}'
```

> Ver documentación completa en `mcp/docs/docs.md`

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

## Monitoreo de Consumo de API

El sistema incluye un logger de consumo de Gemini AI:

```bash
# Ver consumo en los logs
docker-compose logs backend | grep "GEMINI API CONSUMPTION"

# O via API
curl http://localhost:8000/api/v1/dashboard/api-consumption
```

### Métricas Disponibles

- Total de requests
- Input/Output tokens
- Thinking tokens (para modelos con thinking mode)
- Latencia promedio
- Tasa de éxito/error

---

## Endpoints Principales

### Auth
- `POST /api/v1/auth/register` - Registro
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Usuario actual

### RFP
- `POST /api/v1/rfp/upload` - Subir RFP
- `GET /api/v1/rfp` - Listar RFPs
- `GET /api/v1/rfp/{id}` - Detalle RFP
- `POST /api/v1/rfp/{id}/decision` - GO/NO GO
- `GET /api/v1/rfp/{id}/questions` - Preguntas generadas

### Dashboard
- `GET /api/v1/dashboard/stats` - Estadísticas
- `GET /api/v1/dashboard/api-consumption` - Consumo Gemini

---

## Tema Visual

**Dark Mode Premium** con colores TIVIT:

- Fondo principal: `#0A0A0B`
- Cards: `#141416`
- Rojo primario: `#E31837`
- Rojo hover: `#FF2D4D`

---

## Comandos Útiles

```bash
# Reiniciar solo un servicio
docker-compose restart backend
docker-compose restart mcp

# Ver logs de un servicio específico
docker-compose logs -f backend
docker-compose logs -f mcp

# Ejecutar migraciones (si Alembic está configurado)
docker-compose exec backend alembic upgrade head

# Acceder al contenedor
docker-compose exec backend bash
docker-compose exec mcp bash

# Reconstruir índices vectoriales del MCP
curl -X POST http://localhost:8083/reindex

# Limpiar todo (incluyendo volúmenes)
docker-compose down -v
```

---

## Licencia

Proyecto privado para TIVIT.
