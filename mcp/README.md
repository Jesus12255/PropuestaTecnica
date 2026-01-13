# MCP Talent Search API v3.0

Sistema de búsqueda semántica de talento para Team Building automatizado en licitaciones (RFP).

> **Documentación técnica completa:** Ver [docs/docs.md](docs/docs.md)

## Características Principales

| Feature | Descripción |
|---------|-------------|
| **Perfiles Enriquecidos** | Retorna TODAS las certificaciones y skills de cada candidato |
| **Búsqueda Semántica** | Encuentra matches por significado usando embeddings multilingües |
| **Chat Natural con Gemini** | Interpreta consultas en lenguaje natural automáticamente |
| **Batch Search** | Busca equipos completos para múltiples roles en una llamada |
| **Deduplicación** | Elimina candidatos duplicados manteniendo el mejor score |
| **API REST + MCP** | Doble interfaz para máxima flexibilidad |
| **Dockerizado** | Se integra con docker-compose del proyecto principal |

---

## Ejecución con Docker (Recomendado)

El servicio MCP está integrado en el `docker-compose.yml` principal:

```bash
# Desde la raíz del proyecto (v2/)
docker-compose up --build

# O solo el servicio MCP
docker-compose up --build mcp
```

**Requisitos:**
- Los archivos Excel deben estar en `mcp/`:
  - `Capital_Intelectual.xlsx` - Base de certificaciones
  - `Census.xlsx` - Base de RRHH/Skills

**URLs:**
- **API:** http://localhost:8083
- **Swagger UI:** http://localhost:8083/docs
- **ReDoc:** http://localhost:8083/redoc

---

## Ejecución Local (sin Docker)

### Requisitos
- Python 3.10+
- ~2GB RAM (modelo de embeddings)
- API Key de Google (para Gemini)

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

### Configuración

Crear archivo `.env` en la carpeta `mcp/`:

```env
# Gemini API (obligatorio para /chat)
GOOGLE_API_KEY=tu_api_key_de_gemini

# Modelo de Gemini (opcional)
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# Puerto del servidor (opcional)
MCP_PORT=8083
```

### Archivos de Datos Requeridos

```
mcp/
├── Capital_Intelectual.xlsx  # Base de certificaciones
├── Census.xlsx               # Base de RRHH/Skills
└── server.py
```

### Ejecutar

```bash
# Modo HTTP (recomendado)
python server.py

# Modo MCP (stdio)
MCP_MODE=mcp python server.py
```

---

## Endpoints

### Sistema

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servicio |
| `/countries` | GET | Lista de países disponibles |
| `/stats` | GET | Estadísticas del sistema |
| `/reindex` | POST | Reconstruir índices |
| `/docs` | GET | Documentación Swagger |

### Búsqueda

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/search` | POST | Búsqueda simple con perfil enriquecido |
| `/batch-search` | POST | Búsqueda por múltiples roles |
| `/chat` | POST | Consulta en lenguaje natural (Gemini) |

---

## Ejemplos de Uso

### 1. Búsqueda Simple

```bash
curl -X POST http://localhost:8083/search \
  -H "Content-Type: application/json" \
  -d '{
    "consulta": "Java Spring Boot Microservicios",
    "limit": 5,
    "pais": "Chile"
  }'
```

**Respuesta:**
```json
{
  "exito": true,
  "mensaje": "Se encontraron 5 candidatos",
  "total": 5,
  "candidatos": [
    {
      "matricula": "12345",
      "nombre": "Juan Pérez González",
      "email": "juan.perez@tivit.com",
      "cargo": "Senior Java Developer",
      "pais": "Chile",
      "certificaciones": [
        {"nombre": "Oracle Certified Java SE 11 Developer", "institucion": "Oracle", "fecha_emision": "2024-01-15"},
        {"nombre": "AWS Solutions Architect Associate", "institucion": "Amazon", "fecha_emision": "2023-06-20"},
        {"nombre": "Spring Professional", "institucion": "VMware", "fecha_emision": "2023-03-10"}
      ],
      "skills": [
        {"nombre": "Java", "categoria": "Backend", "proficiencia": 5},
        {"nombre": "Spring Boot", "categoria": "Framework", "proficiencia": 5},
        {"nombre": "Kubernetes", "categoria": "DevOps", "proficiencia": 4},
        {"nombre": "PostgreSQL", "categoria": "Database", "proficiencia": 4}
      ],
      "lider": {
        "nombre": "María Jefe Silva",
        "email": "maria.jefe@tivit.com"
      },
      "match_principal": "Oracle Certified Java SE 11 Developer",
      "score": 0.8923
    }
  ]
}
```

### 2. Búsqueda Batch (Equipo Completo)

```bash
curl -X POST http://localhost:8083/batch-search \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Respuesta:**
```json
{
  "exito": true,
  "mensaje": "Búsqueda completada: 3 roles, 9 candidatos",
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
    },
    "DBA": {
      "rol_id": "DBA",
      "descripcion": "Oracle Database Administrator RAC DataGuard",
      "total": 2,
      "candidatos": [...]
    }
  }
}
```

### 3. Chat Natural (Gemini)

```bash
curl -X POST http://localhost:8083/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mensaje": "Necesito armar un equipo de 5 personas para un proyecto de migración a la nube en Colombia. Necesito gente con experiencia en AWS y Azure."
  }'
```

**Respuesta:**
```json
{
  "exito": true,
  "mensaje_original": "Necesito armar un equipo de 5 personas para un proyecto de migración a la nube en Colombia...",
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
    "resumen": "Equipo de 5 personas para migración cloud en Colombia con AWS/Azure"
  },
  "total": 5,
  "candidatos": [...],
  "respuesta_natural": "Encontré 5 candidatos ideales para tu proyecto de migración cloud en Colombia. Los mejores perfiles son Carlos Rodríguez (Cloud Architect con 8 certificaciones AWS y Azure) y Ana García (DevOps Engineer certificada en Kubernetes y Terraform). Todos tienen experiencia demostrada en proyectos de migración."
}
```

---

## Modelo de Datos

### PerfilCompleto

El modelo principal que retorna la API con toda la información del candidato:

```typescript
interface PerfilCompleto {
  matricula: string;           // ID único del empleado
  nombre: string;              // Nombre completo
  email: string;               // Email corporativo
  cargo: string;               // Cargo actual
  pais: string | null;         // País donde trabaja
  
  certificaciones: Array<{     // TODAS las certificaciones
    nombre: string;
    institucion: string;
    fecha_emision: string | null;
    fecha_expiracion: string | null;
  }>;
  
  skills: Array<{              // TODOS los skills técnicos
    nombre: string;
    categoria: string | null;
    proficiencia: number | null;  // 1-5
  }>;
  
  lider: {                     // Información del líder directo
    nombre: string | null;
    email: string | null;
  } | null;
  
  match_principal: string;     // Cert/skill que matcheó la búsqueda
  score: number;               // Score de similitud (0-1)
}
```

---

## Integración con Gemini

El endpoint `/chat` usa **Gemini 2.5 Flash** para:

1. **Interpretar** la consulta en lenguaje natural
2. **Extraer** roles, skills, países y cantidades
3. **Expandir** términos técnicos relacionados
4. **Generar** respuesta natural con los resultados

### Configuración

```env
GOOGLE_API_KEY=AIza...  # API Key de Google AI Studio
GEMINI_MODEL=gemini-2.5-flash-preview-05-20  # o gemini-2.0-flash-exp
```

### Sin Gemini

Si no se configura la API Key, el endpoint `/chat` funciona en modo degradado:
- Usa la consulta directamente sin interpretación
- No genera respuesta en lenguaje natural

---

## Arquitectura

```
┌────────────────────────────────────────────────────────────────┐
│                     Usuario / Agente IA                         │
└─────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    FastAPI REST Server                          │
│                     Puerto: 8083                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   /search    │  │ /batch-search│  │       /chat          │  │
│  │   (simple)   │  │   (roles)    │  │  (Gemini NLP)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────────────┬┴──────────────────────┘              │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              search_and_enrich()                         │   │
│  │  1. Búsqueda vectorial (LanceDB)                        │   │
│  │  2. Deduplicación por matrícula                         │   │
│  │  3. Enriquecimiento (TODAS certs + skills)              │   │
│  │  4. Info del líder                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    LanceDB      │  │    LanceDB      │  │   Raw DataFrames │
│ Certificaciones │  │     Skills      │  │    (Cache)       │
│   (vectores)    │  │   (vectores)    │  │                  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│     Capital_Intelectual.xlsx    │       Census.xlsx            │
│     (Certificaciones 1:N)       │     (Skills/RRHH 1:N)        │
└────────────────────────────────────────────────────────────────┘
```

---

## Filtros Automáticos

### Certificaciones (Capital_Intelectual.xlsx)
| Filtro | Valor | Descripción |
|--------|-------|-------------|
| Status | `Verificado` | Solo certificaciones validadas |
| Expirado | `Nao` | Solo certificaciones vigentes |

### RRHH/Skills (Census.xlsx)
| Filtro | Valor | Descripción |
|--------|-------|-------------|
| Status Colaborador | `Ativo` | Solo empleados activos |

---

## Integración con Claude Desktop

Agregar al archivo de configuración:

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

## Herramientas MCP

Cuando se ejecuta en modo MCP, expone estas herramientas:

### `buscar_talento`
```python
buscar_talento(consulta="Java Spring", pais="Chile", limit=10)
```

### `buscar_equipo`
```python
buscar_equipo(roles_json='[{"rol_id": "Dev", "descripcion": "Java", "cantidad": 5}]')
```

### `listar_paises`
```python
listar_paises()
```

---

## Python Client Example

```python
import requests

BASE_URL = "http://localhost:8083"

# Health check
health = requests.get(f"{BASE_URL}/health").json()
print(f"Status: {health['status']}")
print(f"Certificaciones: {health['total_certificaciones']}")
print(f"Skills: {health['total_skills']}")

# Búsqueda con chat natural
response = requests.post(f"{BASE_URL}/chat", json={
    "mensaje": "Necesito 3 desarrolladores Python senior para Brasil"
})
data = response.json()

print(f"\nInterpretación: {data['interpretacion']['resumen']}")
print(f"Candidatos encontrados: {data['total']}")

for candidato in data['candidatos']:
    print(f"\n{candidato['nombre']} ({candidato['cargo']})")
    print(f"  Email: {candidato['email']}")
    print(f"  Score: {candidato['score']:.0%}")
    print(f"  Certificaciones: {len(candidato['certificaciones'])}")
    for cert in candidato['certificaciones'][:3]:
        print(f"    - {cert['nombre']}")
    print(f"  Skills: {len(candidato['skills'])}")
    for skill in candidato['skills'][:5]:
        prof = f" (nivel {skill['proficiencia']})" if skill['proficiencia'] else ""
        print(f"    - {skill['nombre']}{prof}")
    if candidato['lider']:
        print(f"  Líder: {candidato['lider']['nombre']} ({candidato['lider']['email']})")
```

---

## Troubleshooting

### "Import could not be resolved"
**Causa:** Dependencias no instaladas
**Solución:** `pip install -r requirements.txt`

### "GOOGLE_API_KEY no configurada"
**Causa:** Variable de entorno no definida
**Solución:** Crear `.env` con la API key o exportar variable

### "No se encontraron candidatos"
**Causas posibles:**
1. Archivos Excel no presentes
2. Filtros muy restrictivos
3. Índices no construidos

**Solución:** Verificar `/health` y llamar `/reindex`

### Primera ejecución lenta
**Causa:** Descarga del modelo de embeddings (~500MB)
**Solución:** Esperar, las siguientes ejecuciones serán rápidas

---

## Licencia

Proyecto interno TIVIT - Uso exclusivo corporativo.
