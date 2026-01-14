# MCP Talent Search API - Documentacion Tecnica

> **Version:** 3.0.0  
> **Protocolo:** REST API + MCP (Model Context Protocol)  
> **Puerto por defecto:** 8083  
> **Docker:** Integrado con docker-compose

---

## Tabla de Contenidos

1. [Resumen](#resumen)
2. [Arquitectura](#arquitectura)
3. [Docker](#docker)
4. [Instalacion Local](#instalacion-local)
5. [Configuracion](#configuracion)
6. [Endpoints REST](#endpoints-rest)
7. [Herramientas MCP](#herramientas-mcp)
8. [Modelos de Datos](#modelos-de-datos)
9. [Ejemplos de Uso](#ejemplos-de-uso)
10. [Integracion con Gemini](#integracion-con-gemini)
11. [Troubleshooting](#troubleshooting)

---

## Resumen

El **MCP Talent Search** es un sistema de busqueda semantica de talento diseñado para automatizar el proceso de Team Building en licitaciones (RFP). Utiliza embeddings multilingues para encontrar candidatos basandose en skills y certificaciones.

### Caracteristicas Principales

| Feature | Descripcion |
|---------|-------------|
| **Perfiles Enriquecidos** | Retorna TODAS las certificaciones y skills de cada candidato |
| **Busqueda Semantica** | Encuentra matches por significado usando embeddings multilingues |
| **Chat Natural (Gemini)** | Interpreta consultas en lenguaje natural automaticamente |
| **Batch Search** | Busca equipos completos para multiples roles en una llamada |
| **Deduplicacion** | Elimina candidatos duplicados manteniendo el mejor score |
| **Dual Interface** | API REST + MCP para maxima flexibilidad |

### Filtros Automaticos

- **Certificaciones:** Solo `Status=Verificado` y `Expirado=Nao`
- **Colaboradores:** Solo `Status=Ativo`

---

## Arquitectura

```
+------------------------------------------------------------------+
|                     Usuario / Agente IA                          |
+--------------------------------+---------------------------------+
                                 |
                                 v
+------------------------------------------------------------------+
|                    FastAPI REST Server                           |
|                     Puerto: 8083                                 |
|  +----------------+  +----------------+  +--------------------+  |
|  |   /search      |  | /batch-search  |  |      /chat         |  |
|  |   (simple)     |  |    (roles)     |  |   (Gemini NLP)     |  |
|  +-------+--------+  +-------+--------+  +---------+----------+  |
|          |                   |                     |             |
|          +-------------------+---------------------+             |
|                              |                                   |
|                              v                                   |
|  +-------------------------------------------------------+       |
|  |              search_and_enrich()                       |       |
|  |  1. Busqueda vectorial (LanceDB)                      |       |
|  |  2. Deduplicacion por matricula                       |       |
|  |  3. Enriquecimiento (TODAS certs + skills)            |       |
|  |  4. Info del lider                                    |       |
|  +-------------------------------------------------------+       |
+------------------------------------------------------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
+-----------------+  +-----------------+  +------------------+
|    LanceDB      |  |    LanceDB      |  |  Raw DataFrames  |
| Certificaciones |  |     Skills      |  |     (Cache)      |
|   (vectores)    |  |   (vectores)    |  |                  |
+-----------------+  +-----------------+  +------------------+
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
+------------------------------------------------------------------+
|     Capital_Intelectual.xlsx    |       Census.xlsx             |
|     (Certificaciones 1:N)       |     (Skills/RRHH 1:N)         |
+------------------------------------------------------------------+
```

### Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Framework API | FastAPI |
| Vector Store | LanceDB |
| Embeddings | sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) |
| Datos | Pandas + openpyxl |
| LLM | Google Gemini 2.5 Flash |
| Protocolo MCP | mcp-python |
| Container | Docker (multi-stage build) |

---

## Docker

El servicio MCP esta integrado en el `docker-compose.yml` principal del proyecto.

### Ejecucion con Docker Compose

```bash
# Desde la raiz del proyecto (v2/)
docker-compose up --build

# Solo el servicio MCP
docker-compose up --build mcp

# Ver logs del MCP
docker-compose logs -f mcp
```

### Configuracion Docker

El servicio MCP en `docker-compose.yml`:

```yaml
mcp:
  build:
    context: ./mcp
    dockerfile: Dockerfile
  container_name: rfp_mcp
  ports:
    - "8083:8083"
  environment:
    MCP_MODE: http
    MCP_PORT: 8083
    GOOGLE_API_KEY: ${GOOGLE_API_KEY:-}
    GEMINI_MODEL: ${MCP_GEMINI_MODEL:-gemini-2.5-flash-preview-05-20}
  volumes:
    - ./mcp/Capital_Intelectual.xlsx:/app/Capital_Intelectual.xlsx:ro
    - ./mcp/Census.xlsx:/app/Census.xlsx:ro
    - mcp_lancedb:/app/lancedb_data
```

### Archivos de Datos Requeridos

Los archivos Excel deben estar en la carpeta `mcp/`:

```
mcp/
├── Capital_Intelectual.xlsx  # Base de certificaciones
├── Census.xlsx               # Base de RRHH/Skills
```

### Health Check

El contenedor incluye health check automatico:

```bash
curl http://localhost:8083/health
```

---

## Instalacion Local

### Requisitos

- Python 3.10+
- ~2GB RAM (modelo de embeddings)
- API Key de Google (para Gemini - opcional)

### Setup

```bash
cd mcp

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt
```

### Archivos de Datos Requeridos

```
mcp/
├── Capital_Intelectual.xlsx  # Base de certificaciones
├── Census.xlsx               # Base de RRHH/Skills
├── server.py                 # Servidor principal
└── requirements.txt          # Dependencias
```

---

## Configuracion

Crear archivo `.env` en la carpeta `mcp/`:

```env
# Gemini API (obligatorio para /chat)
GOOGLE_API_KEY=tu_api_key_de_gemini

# Modelo de Gemini (opcional)
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# Puerto del servidor (opcional)
MCP_PORT=8083

# Modo de ejecucion (http o mcp)
MCP_MODE=http
```

### Variables de Entorno

| Variable | Requerido | Default | Descripcion |
|----------|-----------|---------|-------------|
| `GOOGLE_API_KEY` | No* | - | API Key de Google AI Studio |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-preview-05-20` | Modelo de Gemini a usar |
| `MCP_PORT` | No | `8083` | Puerto del servidor HTTP |
| `MCP_MODE` | No | `http` | `http` para REST, `mcp` para stdio |

*Requerido solo para el endpoint `/chat`

---

## Endpoints REST

### Sistema

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/health` | GET | Estado del servicio |
| `/countries` | GET | Lista de paises disponibles |
| `/stats` | GET | Estadisticas del sistema |
| `/reindex` | POST | Reconstruir indices vectoriales |
| `/docs` | GET | Documentacion Swagger UI |
| `/redoc` | GET | Documentacion ReDoc |

### Busqueda

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/search` | POST | Busqueda simple con perfil enriquecido |
| `/batch-search` | POST | Busqueda por multiples roles |
| `/chat` | POST | Consulta en lenguaje natural (Gemini) |

---

### GET /health

Verifica el estado del servicio.

**Response:**
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "gemini_disponible": true,
  "total_certificaciones": 5432,
  "total_skills": 12000,
  "total_colaboradores": 1500,
  "modelo_embeddings": "paraphrase-multilingual-MiniLM-L12-v2"
}
```

---

### GET /countries

Lista paises disponibles para filtrar.

**Response:**
```json
{
  "exito": true,
  "paises": ["Argentina", "Brasil", "Chile", "Colombia", "Mexico", "Peru"],
  "total": 6
}
```

---

### GET /stats

Obtiene estadisticas detalladas del sistema.

**Response:**
```json
{
  "exito": true,
  "estadisticas": {
    "certificaciones": {
      "total": 5432,
      "colaboradores_unicos": 1200,
      "por_pais": {"Brasil": 3000, "Chile": 1500, "Colombia": 932},
      "top_instituciones": {"AWS": 500, "Oracle": 450, "Microsoft": 400}
    },
    "skills": {
      "total": 12000,
      "colaboradores_unicos": 1800,
      "top_skills": {"Java": 500, "Python": 450, "SQL": 400}
    },
    "paises_disponibles": ["Argentina", "Brasil", "Chile"]
  }
}
```

---

### POST /search

Busca candidatos con perfiles enriquecidos.

**Request:**
```json
{
  "consulta": "Java Spring Boot Microservicios",
  "limit": 5,
  "pais": "Chile"
}
```

**Parametros:**

| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `consulta` | string | Si | - | Skills/certificaciones buscadas |
| `limit` | int | No | 10 | Maximo resultados (1-50) |
| `pais` | string | No | null | Filtro por pais |

**Response:**
```json
{
  "exito": true,
  "mensaje": "Se encontraron 5 candidatos",
  "total": 5,
  "candidatos": [
    {
      "matricula": "12345",
      "nombre": "Juan Perez Gonzalez",
      "email": "juan.perez@tivit.com",
      "cargo": "Senior Java Developer",
      "pais": "Chile",
      "certificaciones": [
        {
          "nombre": "Oracle Certified Java SE 11 Developer",
          "institucion": "Oracle",
          "fecha_emision": "2024-01-15",
          "fecha_expiracion": null
        }
      ],
      "skills": [
        {"nombre": "Java", "categoria": "Backend", "proficiencia": 5},
        {"nombre": "Spring Boot", "categoria": "Framework", "proficiencia": 5}
      ],
      "lider": {
        "nombre": "Maria Jefe Silva",
        "email": "maria.jefe@tivit.com"
      },
      "match_principal": "Oracle Certified Java SE 11 Developer",
      "score": 0.8923
    }
  ]
}
```

---

### POST /batch-search

Busca candidatos para multiples roles en una sola llamada.

**Request:**
```json
{
  "roles": [
    {
      "rol_id": "PM_Senior",
      "descripcion": "Project Manager PMP Scrum Master Agile",
      "pais": "Chile",
      "cantidad": 2
    },
    {
      "rol_id": "Dev_Java",
      "descripcion": "Java Spring Boot Microservicios AWS Docker",
      "cantidad": 5
    },
    {
      "rol_id": "DBA",
      "descripcion": "Oracle Database Administrator RAC DataGuard",
      "cantidad": 2
    }
  ]
}
```

**Parametros por Rol:**

| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `rol_id` | string | Si | - | ID unico del rol |
| `descripcion` | string | Si | - | Skills y certificaciones requeridas |
| `pais` | string | No | null | Filtro por pais |
| `cantidad` | int | No | 3 | Candidatos a retornar (1-20) |

**Response:**
```json
{
  "exito": true,
  "mensaje": "Busqueda completada: 3 roles, 9 candidatos",
  "total_roles": 3,
  "total_candidatos": 9,
  "resultados": {
    "PM_Senior": {
      "rol_id": "PM_Senior",
      "descripcion": "Project Manager PMP Scrum Master Agile",
      "total": 2,
      "candidatos": [...]
    },
    "Dev_Java": {
      "rol_id": "Dev_Java",
      "descripcion": "Java Spring Boot Microservicios AWS Docker",
      "total": 5,
      "candidatos": [...]
    }
  }
}
```

---

### POST /chat

Consulta en lenguaje natural usando Gemini.

**Request:**
```json
{
  "mensaje": "Necesito armar un equipo de 5 personas para migracion a la nube en Colombia. Necesito gente con AWS y Azure.",
  "pais_default": null
}
```

**Response:**
```json
{
  "exito": true,
  "mensaje_original": "Necesito armar un equipo de 5 personas...",
  "interpretacion": {
    "roles": [
      {
        "rol_id": "Cloud_Architect",
        "descripcion": "AWS Azure Cloud Solutions Architect Migration",
        "pais": "Colombia",
        "cantidad": 2
      },
      {
        "rol_id": "Cloud_Engineer",
        "descripcion": "AWS Azure DevOps Kubernetes Terraform",
        "pais": "Colombia",
        "cantidad": 3
      }
    ],
    "resumen": "Equipo de 5 personas para migracion cloud en Colombia"
  },
  "total": 5,
  "candidatos": [...],
  "respuesta_natural": "Encontre 5 candidatos ideales para tu proyecto de migracion cloud en Colombia. Los mejores perfiles son Carlos Rodriguez (Cloud Architect con 8 certificaciones AWS y Azure) y Ana Garcia (DevOps Engineer)."
}
```

---

### POST /reindex

Reconstruye los indices vectoriales.

**Response:**
```json
{
  "exito": true,
  "mensaje": "Indices reconstruidos",
  "certificaciones": 5432,
  "skills": 12000
}
```

---

## Herramientas MCP

Cuando se ejecuta en modo MCP (`MCP_MODE=mcp`), expone las siguientes herramientas:

### buscar_talento

Busca candidatos con perfiles enriquecidos.

```python
buscar_talento(consulta: str, pais: str = None, limit: int = 10) -> str
```

**Ejemplo:**
```python
resultado = buscar_talento("Java Spring", pais="Chile", limit=5)
```

### buscar_equipo

Busca equipo completo para multiples roles.

```python
buscar_equipo(roles_json: str) -> str
```

**Ejemplo:**
```python
roles = '[{"rol_id": "Dev_Java", "descripcion": "Java Spring", "cantidad": 5}]'
resultado = buscar_equipo(roles_json=roles)
```

### listar_paises

Lista paises disponibles.

```python
listar_paises() -> str
```

---

## Modelos de Datos

### PerfilCompleto

Modelo principal que retorna la API con toda la informacion del candidato:

```typescript
interface PerfilCompleto {
  matricula: string;           // ID unico del empleado
  nombre: string;              // Nombre completo
  email: string;               // Email corporativo
  cargo: string;               // Cargo actual
  pais: string | null;         // Pais donde trabaja
  
  certificaciones: Array<{     // TODAS las certificaciones
    nombre: string;
    institucion: string;
    fecha_emision: string | null;
    fecha_expiracion: string | null;
  }>;
  
  skills: Array<{              // TODOS los skills tecnicos
    nombre: string;
    categoria: string | null;
    proficiencia: number | null;  // 1-5
  }>;
  
  lider: {                     // Informacion del lider directo
    nombre: string | null;
    email: string | null;
  } | null;
  
  match_principal: string;     // Cert/skill que matcheo la busqueda
  score: number;               // Score de similitud (0-1)
}
```

### RequerimientoRol

```typescript
interface RequerimientoRol {
  rol_id: string;              // ID unico del rol (ej: "PM_Senior")
  descripcion: string;         // Skills y certificaciones requeridas
  pais: string | null;         // Filtro por pais
  cantidad: number;            // Candidatos a retornar (default: 3)
}
```

---

## Ejemplos de Uso

### Python Client

```python
import requests

BASE_URL = "http://localhost:8083"

# Health check
health = requests.get(f"{BASE_URL}/health").json()
print(f"Status: {health['status']}")
print(f"Certificaciones: {health['total_certificaciones']}")

# Busqueda simple
response = requests.post(f"{BASE_URL}/search", json={
    "consulta": "Java Spring Boot",
    "limit": 5,
    "pais": "Chile"
})
data = response.json()
print(f"Candidatos encontrados: {data['total']}")

for candidato in data['candidatos']:
    print(f"- {candidato['nombre']} ({candidato['cargo']})")
    print(f"  Score: {candidato['score']:.0%}")
```

### cURL

```bash
# Busqueda simple
curl -X POST http://localhost:8083/search \
  -H "Content-Type: application/json" \
  -d '{"consulta": "Java Spring", "limit": 5}'

# Chat natural
curl -X POST http://localhost:8083/chat \
  -H "Content-Type: application/json" \
  -d '{"mensaje": "Necesito 3 desarrolladores Python para Brasil"}'
```

---

## Integracion con Gemini

El endpoint `/chat` usa **Gemini 2.5 Flash** para:

1. **Interpretar** la consulta en lenguaje natural
2. **Extraer** roles, skills, paises y cantidades
3. **Expandir** terminos tecnicos relacionados
4. **Generar** respuesta natural con los resultados

### Configuracion

```env
GOOGLE_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
```

### Sin Gemini

Si no se configura la API Key, el endpoint `/chat` funciona en modo degradado:
- Usa la consulta directamente sin interpretacion
- No genera respuesta en lenguaje natural

---

## Integracion con Claude Desktop

Agregar al archivo de configuracion:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "talent-search": {
      "command": "python",
      "args": ["C:/ruta/completa/mcp/server.py"],
      "env": {
        "MCP_MODE": "mcp",
        "GOOGLE_API_KEY": "tu_api_key"
      }
    }
  }
}
```

---

## Troubleshooting

### "Import could not be resolved"

**Causa:** Dependencias no instaladas  
**Solucion:** `pip install -r requirements.txt`

### "GOOGLE_API_KEY no configurada"

**Causa:** Variable de entorno no definida  
**Solucion:** Crear `.env` con la API key o exportar variable

### "No se encontraron candidatos"

**Causas posibles:**
1. Archivos Excel no presentes
2. Filtros muy restrictivos
3. Indices no construidos

**Solucion:** Verificar `/health` y llamar `/reindex`

### Primera ejecucion lenta

**Causa:** Descarga del modelo de embeddings (~500MB)  
**Solucion:** Esperar, las siguientes ejecuciones seran rapidas

### Error de memoria

**Causa:** Modelo de embeddings requiere ~2GB RAM  
**Solucion:** Usar maquina con mas memoria o modelo mas ligero

---

## Ejecucion

### Modo HTTP (recomendado)

```bash
python server.py
```

El servidor inicia en `http://localhost:8083`

- **Swagger UI:** http://localhost:8083/docs
- **ReDoc:** http://localhost:8083/redoc

### Modo MCP (stdio)

```bash
MCP_MODE=mcp python server.py
```

---

---

## Integracion con RFP Analyzer Backend

El **MCP Talent Search** esta integrado con el sistema **RFP Analyzer** para automatizar la busqueda de candidatos basandose en la estimacion de equipo generada por IA.

### Flujo de Integracion

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|   RFP Document   | --> |   Gemini 2.0      | --> |  Team Estimation |
|   (PDF/DOCX)     |     |   (con Grounding) |     |  + Cost Analysis |
|                  |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
                                                           |
                                                           v
                         +-------------------+     +------------------+
                         |                   |     |                  |
                         |   MCP Talent      | <-- |  MCPTalentClient |
                         |   Search Server   |     |  (Backend)       |
                         |                   |     |                  |
                         +-------------------+     +------------------+
                                  |
                                  v
                         +-------------------+
                         |                   |
                         |  Candidatos       |
                         |  Reales TIVIT     |
                         |                   |
                         +-------------------+
```

### Cliente MCP en Backend

El backend incluye un cliente HTTP para conectar con MCP:

**Archivo:** `backend/core/services/mcp_client.py`

```python
import httpx
from core.config import settings

async def search_talent_for_team(roles: list[dict]) -> dict:
    """
    Busca candidatos para un equipo completo.
    
    Args:
        roles: Lista de roles con descripcion, pais y cantidad
        
    Returns:
        Resultados del MCP con candidatos por rol
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.MCP_TALENT_URL}/batch-search",
            json={"roles": roles}
        )
        response.raise_for_status()
        return response.json()
```

### Endpoint del Backend

El backend expone un endpoint que conecta la estimacion de equipo con MCP:

**Endpoint:** `POST /api/v1/rfp/{id}/suggest-team`

**Flujo:**
1. Obtiene la estimacion de equipo del RFP (generada por Gemini)
2. Convierte roles a formato MCP
3. Llama a `POST /batch-search` del MCP
4. Guarda y retorna los candidatos encontrados

### Formato de Conversion

La estimacion de equipo de Gemini se convierte al formato MCP:

**Input (team_estimation de Gemini):**
```json
{
  "roles": [
    {
      "role_id": "Dev_Java_Sr",
      "title": "Desarrollador Java Senior",
      "quantity": 3,
      "required_skills": ["Java", "Spring Boot", "AWS"],
      "required_certifications": ["AWS Solutions Architect"]
    }
  ]
}
```

**Output (formato MCP):**
```json
{
  "roles": [
    {
      "rol_id": "Dev_Java_Sr",
      "descripcion": "Java Spring Boot AWS AWS Solutions Architect Desarrollador Java Senior",
      "pais": "Chile",
      "cantidad": 7
    }
  ]
}
```

**Logica de cantidad:**
- Se solicita al menos el doble de candidatos requeridos
- Minimo 5 candidatos por rol para dar opciones

### Configuracion

Variable de entorno en el Backend:

```bash
# .env del Backend
MCP_TALENT_URL=http://localhost:8083

# En Docker Compose, usa el nombre del servicio
MCP_TALENT_URL=http://mcp:8083
```

### Response del Backend

El endpoint `/suggest-team` retorna:

```json
{
  "rfp_id": "uuid-del-rfp",
  "scenario": "B",
  "team_estimation": {
    "source": "ai_estimated",
    "confidence": 0.85,
    "roles": [...]
  },
  "cost_estimation": {
    "monthly_base": 45000,
    "currency": "USD",
    "viability": {...}
  },
  "suggested_team": {
    "mcp_available": true,
    "total_roles": 5,
    "total_candidatos": 28,
    "coverage_percent": 100,
    "resultados": {
      "Dev_Java_Sr": {
        "rol_id": "Dev_Java_Sr",
        "descripcion": "Java Spring Boot...",
        "total": 7,
        "candidatos": [...]
      }
    }
  },
  "message": "Equipo sugerido con 28 candidatos para 5 roles"
}
```

### Manejo de Errores

Si el MCP no esta disponible:

```json
{
  "suggested_team": {
    "mcp_available": false,
    "error": "MCP Talent Search no disponible",
    "resultados": {}
  }
}
```

El frontend muestra un mensaje apropiado y permite reintentar.

---

## Licencia

Proyecto interno TIVIT - Uso exclusivo corporativo.
