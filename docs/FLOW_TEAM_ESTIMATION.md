# Flujo de Estimacion de Equipo y Costos

> **Version:** 1.0  
> **Fecha:** Enero 2026  
> **Modulo:** RFP Analyzer - Team Estimation

---

## Tabla de Contenidos

1. [Resumen](#resumen)
2. [Flujo General](#flujo-general)
3. [Deteccion de Escenarios](#deteccion-de-escenarios)
4. [Flujo por Escenario](#flujo-por-escenario)
5. [Arquitectura de Componentes](#arquitectura-de-componentes)
6. [Flujo de Datos](#flujo-de-datos)
7. [Integracion Frontend](#integracion-frontend)
8. [Endpoints API](#endpoints-api)
9. [Ejemplos de Uso](#ejemplos-de-uso)

---

## Resumen

El sistema de estimacion de equipo analiza automaticamente los RFPs para:

1. **Detectar** si el cliente especifico personal y/o presupuesto
2. **Estimar** el equipo necesario basado en el alcance (si no se especifico)
3. **Calcular** costos usando tarifas de mercado actuales (Google Search Grounding)
4. **Validar** viabilidad comparando con presupuesto del cliente
5. **Buscar** candidatos reales en la base de talento TIVIT

---

## Flujo General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO PRINCIPAL                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   Usuario    │
    │  sube RFP    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   Frontend   │────▶│   Backend    │────▶│   Storage    │
    │   Upload     │     │   /upload    │     │   (GCS)      │
    └──────────────┘     └──────┬───────┘     └──────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Gemini 2.0     │
                       │   Flash          │
                       │   + Grounding    │
                       └────────┬─────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │   Extrae     │   │   Detecta    │   │   Estima     │
    │   Datos RFP  │   │   Escenario  │   │   Equipo     │
    └──────────────┘   └──────────────┘   │   y Costos   │
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                        ┌──────────────┐
                                        │   Guarda en  │
                                        │   PostgreSQL │
                                        └──────┬───────┘
                                                 │
                                                 ▼
    ┌──────────────┐                    ┌──────────────┐
    │   Usuario    │◀───────────────────│   Frontend   │
    │   ve tabs    │                    │   muestra    │
    └──────┬───────┘                    └──────────────┘
           │
           │ Clic "Buscar Candidatos"
           ▼
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   Frontend   │────▶│   Backend    │────▶│     MCP      │
    │   request    │     │/suggest-team │     │   Talent     │
    └──────────────┘     └──────────────┘     └──────┬───────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  Candidatos  │
                                              │  Reales      │
                                              │  TIVIT       │
                                              └──────────────┘
```

---

## Deteccion de Escenarios

El sistema detecta automaticamente 1 de 4 escenarios basado en el contenido del RFP:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MATRIZ DE ESCENARIOS (2x2)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                        │   Con Presupuesto   │   Sin Presupuesto   │
    ────────────────────┼─────────────────────┼─────────────────────┤
                        │                     │                     │
       Con Personal     │    ESCENARIO A      │    ESCENARIO C      │
       Especificado     │                     │                     │
                        │    IA VALIDA        │    IA ESTIMA        │
                        │    viabilidad       │    presupuesto      │
                        │                     │                     │
    ────────────────────┼─────────────────────┼─────────────────────┤
                        │                     │                     │
       Sin Personal     │    ESCENARIO B      │    ESCENARIO D      │
       Especificado     │                     │                     │
                        │    IA SUGIERE       │    IA SUGIERE       │
                        │    equipo optimo    │    todo             │
                        │                     │                     │
    ────────────────────┴─────────────────────┴─────────────────────┘
```

### Variables de Deteccion

| Variable | Como se detecta |
|----------|-----------------|
| **Personal** | RFP menciona roles, cantidad de personas, perfiles requeridos |
| **Presupuesto** | RFP indica monto, rango presupuestario, valor del contrato |

---

## Flujo por Escenario

### Escenario A: Personal + Presupuesto (Validar)

```
┌───────────────────────────────────────────────────────────────┐
│  ESCENARIO A: Validar Viabilidad                              │
│  Input: Personal definido + Presupuesto definido              │
└───────────────────────────────────────────────────────────────┘

    RFP dice: "5 devs Java, presupuesto $25,000/mes, Chile"
                            │
                            ▼
    ┌─────────────────────────────────────────────┐
    │  1. GROUNDING: Buscar tarifas               │
    │     "salario desarrollador java chile usd"  │
    │     Resultado: $5,000 - $6,500/mes          │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  2. CALCULAR: Costo del equipo              │
    │     5 devs x $5,750 promedio = $28,750/mes  │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  3. COMPARAR: vs presupuesto cliente        │
    │     $25,000 < $28,750                       │
    │     Gap: -$3,750 (-13%)                     │
    │     Estado: BAJO PRESUPUESTO                │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  4. RECOMENDAR:                             │
    │     - Aumentar presupuesto a $29,000        │
    │     - Reducir a 4 devs ($23,000)            │
    │     - Mezclar: 3 senior + 2 mid ($25,000)   │
    └─────────────────────────────────────────────┘
```

### Escenario B: Sin Personal + Con Presupuesto (Sugerir equipo)

```
┌───────────────────────────────────────────────────────────────┐
│  ESCENARIO B: Sugerir Equipo Optimo                           │
│  Input: Sin personal + Presupuesto definido                   │
└───────────────────────────────────────────────────────────────┘

    RFP dice: "App movil ecommerce, $50,000/mes, Peru"
                            │
                            ▼
    ┌─────────────────────────────────────────────┐
    │  1. ANALIZAR: Alcance del proyecto          │
    │     - App movil iOS + Android               │
    │     - Backend con APIs                      │
    │     - Integracion pagos                     │
    │     - Complejidad: Alta                     │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  2. ESTIMAR: Equipo necesario               │
    │     - PM Senior (1)                         │
    │     - Tech Lead (1)                         │
    │     - Mobile Devs (3)                       │
    │     - Backend Devs (2)                      │
    │     - QA (1)                                │
    │     - DevOps (1)                            │
    │     Total: 9 personas                       │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  3. GROUNDING + CALCULAR: Costos            │
    │     PM: $7,000 | Lead: $8,500               │
    │     Mobile: 3 x $6,000 = $18,000            │
    │     Backend: 2 x $5,500 = $11,000           │
    │     QA: $4,500 | DevOps: $6,500             │
    │     Total: $55,500/mes                      │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  4. COMPARAR: vs presupuesto                │
    │     $50,000 < $55,500                       │
    │     Gap: -$5,500 (-10%)                     │
    │     Estado: LIGERAMENTE SOBRE PRESUPUESTO   │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  5. AJUSTAR: Equipo optimizado              │
    │     Reducir a 2 Mobile, 1 Backend           │
    │     Nuevo total: $42,000/mes                │
    │     Estado: VIABLE con margen               │
    └─────────────────────────────────────────────┘
```

### Escenario C: Con Personal + Sin Presupuesto (Estimar costo)

```
┌───────────────────────────────────────────────────────────────┐
│  ESCENARIO C: Estimar Presupuesto                             │
│  Input: Personal definido + Sin presupuesto                   │
└───────────────────────────────────────────────────────────────┘

    RFP dice: "5 ingenieros cloud AWS, Colombia"
                            │
                            ▼
    ┌─────────────────────────────────────────────┐
    │  1. GROUNDING: Buscar tarifas               │
    │     "cloud engineer aws salary colombia"    │
    │     Resultado: $6,000 - $8,000/mes          │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  2. CALCULAR: Costo base                    │
    │     5 x $7,000 promedio = $35,000/mes       │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  3. AGREGAR MARGEN: 15-25%                  │
    │     Margen 20%: $7,000                      │
    │     Total sugerido: $42,000/mes             │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  4. GENERAR: Presupuesto sugerido           │
    │     Mensual: $42,000 USD                    │
    │     Duracion: 12 meses                      │
    │     Total proyecto: $504,000 USD            │
    └─────────────────────────────────────────────┘
```

### Escenario D: Sin Personal + Sin Presupuesto (Sugerir todo)

```
┌───────────────────────────────────────────────────────────────┐
│  ESCENARIO D: Sugerir Equipo + Presupuesto                    │
│  Input: Sin personal + Sin presupuesto                        │
└───────────────────────────────────────────────────────────────┘

    RFP dice: "Sistema gestion inventarios retail, Brasil"
                            │
                            ▼
    ┌─────────────────────────────────────────────┐
    │  1. ANALIZAR: Alcance del proyecto          │
    │     - ERP de inventarios                    │
    │     - Integracion SAP                       │
    │     - App movil para bodega                 │
    │     - Reporteria BI                         │
    │     Complejidad: Muy Alta                   │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  2. ESTIMAR: Equipo necesario               │
    │     PM (1), Arquitecto (1)                  │
    │     Backend (4), Frontend (2)               │
    │     Mobile (1), QA (2), DBA (1), DevOps (1) │
    │     Total: 13 personas                      │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  3. GROUNDING: Tarifas Brasil               │
    │     (busca cada rol)                        │
    │     Costo base: $78,000/mes                 │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  4. AGREGAR MARGEN: 20%                     │
    │     Margen: $15,600                         │
    │     Total sugerido: $93,600/mes             │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  5. RESULTADO COMPLETO:                     │
    │     Equipo: 13 personas (detallado)         │
    │     Mensual: $93,600 USD                    │
    │     Duracion estimada: 18 meses             │
    │     Total proyecto: $1,684,800 USD          │
    └─────────────────────────────────────────────┘
```

---

## Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARQUITECTURA DEL SISTEMA                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Tab       │  │   Tab       │  │   Tab       │  │   Tab       │        │
│  │  Resumen    │  │  Equipo     │  │  Costos     │  │ Candidatos  │        │
│  │             │  │             │  │             │  │             │        │
│  │ RFPInfo     │  │ TeamView    │  │ CostView    │  │ TeamView    │        │
│  │             │  │             │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         API Client (api.ts)                           │ │
│  │  - rfpApi.get(id)                                                     │ │
│  │  - rfpApi.getTeamEstimation(id)                                       │ │
│  │  - rfpApi.suggestTeam(id, forceRefresh)                              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTP
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (FastAPI)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         api/routes/rfp.py                             │ │
│  │  - GET /rfp/{id}                   → Detalle RFP                      │ │
│  │  - GET /rfp/{id}/team-estimation   → Estimaciones guardadas          │ │
│  │  - POST /rfp/{id}/suggest-team     → Buscar en MCP                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                   │                                        │
│                                   ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    core/services/analyzer.py                          │ │
│  │  - analyze_rfp_from_content()  → Analiza con Gemini + Grounding       │ │
│  │  - Detecta escenario A/B/C/D                                          │ │
│  │  - Genera team_estimation + cost_estimation                           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                   │                                        │
│           ┌───────────────────────┼───────────────────────┐                │
│           ▼                       ▼                       ▼                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ gemini_client   │  │  mcp_client     │  │   PostgreSQL    │            │
│  │ .py             │  │  .py            │  │                 │            │
│  │                 │  │                 │  │  rfp_submissions │            │
│  │ Gemini 2.0      │  │ HTTP Client     │  │  (extracted_data│            │
│  │ + Grounding     │  │ → MCP           │  │   → JSONB)      │            │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘            │
│           │                    │                                           │
└───────────┼────────────────────┼───────────────────────────────────────────┘
            │                    │
            ▼                    ▼
    ┌───────────────┐    ┌───────────────────────────────────────────────────┐
    │ Google Search │    │                MCP TALENT SEARCH                  │
    │ Grounding     │    ├───────────────────────────────────────────────────┤
    │               │    │                                                   │
    │ Tarifas de    │    │  ┌─────────────┐  ┌─────────────┐                │
    │ mercado       │    │  │ /search     │  │/batch-search│                │
    │ actuales      │    │  │ Simple      │  │ Por roles   │                │
    │               │    │  └─────────────┘  └─────────────┘                │
    └───────────────┘    │           │               │                      │
                         │           └───────┬───────┘                      │
                         │                   ▼                              │
                         │          ┌─────────────────┐                     │
                         │          │    LanceDB      │                     │
                         │          │  (Vectores)     │                     │
                         │          └─────────────────┘                     │
                         │                   │                              │
                         │          ┌────────┴────────┐                     │
                         │          ▼                 ▼                     │
                         │  ┌─────────────┐  ┌─────────────┐               │
                         │  │  Census     │  │  Capital    │               │
                         │  │  .xlsx      │  │  Intelectual│               │
                         │  │  (Skills)   │  │  (Certs)    │               │
                         │  └─────────────┘  └─────────────┘               │
                         └───────────────────────────────────────────────────┘
```

---

## Flujo de Datos

### 1. Datos de Entrada (RFP)

```json
{
  "file": "licitacion_banco.pdf",
  "client_specified": {
    "budget": "$100,000/month",
    "team": "5 Java developers, 2 QA"
  }
}
```

### 2. Salida de Gemini (team_estimation)

```json
{
  "team_estimation": {
    "source": "client_specified",
    "scenario": "A",
    "confidence": 0.92,
    "roles": [
      {
        "role_id": "Dev_Java_Sr",
        "title": "Desarrollador Java Senior",
        "quantity": 5,
        "seniority": "senior",
        "required_skills": ["Java", "Spring Boot", "Microservices"],
        "required_certifications": ["AWS Solutions Architect"],
        "dedication": "full_time",
        "duration_months": 12,
        "market_rate": {
          "min": 5000,
          "max": 7000,
          "average": 6000,
          "currency": "USD",
          "source": "Google Search Grounding"
        },
        "subtotal_monthly": 30000
      },
      {
        "role_id": "QA_Sr",
        "title": "QA Engineer Senior",
        "quantity": 2,
        "seniority": "senior",
        "required_skills": ["Selenium", "Automation", "API Testing"],
        "market_rate": {
          "min": 4000,
          "max": 5500,
          "average": 4750,
          "currency": "USD"
        },
        "subtotal_monthly": 9500
      }
    ],
    "total_headcount": 7,
    "rationale": "Equipo basado en requerimientos del cliente..."
  }
}
```

### 3. Salida de Gemini (cost_estimation)

```json
{
  "cost_estimation": {
    "scenario": "A",
    "scenario_description": "Validacion de viabilidad presupuestaria",
    "monthly_base": 39500,
    "currency": "USD",
    "source": "Google Search Grounding",
    "breakdown": [
      {"role": "Desarrollador Java Senior", "quantity": 5, "monthly_rate": 6000, "subtotal": 30000},
      {"role": "QA Engineer Senior", "quantity": 2, "monthly_rate": 4750, "subtotal": 9500}
    ],
    "margin_percent": 20,
    "margin_amount": 7900,
    "suggested_monthly": 47400,
    "duration_months": 12,
    "suggested_total": 568800,
    "viability": {
      "client_budget": 100000,
      "required_budget": 47400,
      "gap": 52600,
      "gap_percent": 52.6,
      "is_viable": true,
      "assessment": "under_budget",
      "recommendations": [
        "Presupuesto suficiente con margen del 52%",
        "Considerar agregar roles de soporte (DevOps, DBA)"
      ]
    }
  }
}
```

### 4. Conversion a formato MCP

```json
{
  "roles": [
    {
      "rol_id": "Dev_Java_Sr",
      "descripcion": "Java Spring Boot Microservices AWS Solutions Architect Desarrollador Java Senior",
      "pais": "Chile",
      "cantidad": 10
    },
    {
      "rol_id": "QA_Sr",
      "descripcion": "Selenium Automation API Testing QA Engineer Senior",
      "pais": "Chile",
      "cantidad": 5
    }
  ]
}
```

### 5. Respuesta del MCP (suggested_team)

```json
{
  "suggested_team": {
    "generated_at": "2026-01-14T15:30:00Z",
    "mcp_available": true,
    "resultados": {
      "Dev_Java_Sr": {
        "rol_id": "Dev_Java_Sr",
        "descripcion": "Java Spring Boot...",
        "candidatos": [
          {
            "matricula": "12345",
            "nombre": "Juan Perez",
            "email": "juan.perez@tivit.com",
            "cargo": "Senior Java Developer",
            "pais": "Chile",
            "score": 0.95,
            "match_principal": "Java Spring Boot",
            "certificaciones": [
              {"nombre": "AWS Solutions Architect", "institucion": "Amazon"}
            ],
            "skills": [
              {"nombre": "Java", "proficiencia": 5},
              {"nombre": "Spring Boot", "proficiencia": 5}
            ],
            "lider": {
              "nombre": "Maria Jefa",
              "email": "maria.jefa@tivit.com"
            }
          }
        ],
        "total": 10
      }
    },
    "total_roles": 2,
    "total_candidatos": 15,
    "coverage_percent": 100
  }
}
```

---

## Integracion Frontend

### Componentes Creados

| Componente | Ubicacion | Descripcion |
|------------|-----------|-------------|
| `TeamEstimationView` | `components/rfp/` | Tabla de roles estimados |
| `CostEstimationView` | `components/rfp/` | Desglose de costos y viabilidad |
| `SuggestedTeamView` | `components/rfp/` | Lista de candidatos por rol |

### Tabs en RFPDetailPage

```
┌────────────┬────────────┬────────────┬────────────┐
│  Resumen   │   Equipo   │   Costos   │ Candidatos │
├────────────┴────────────┴────────────┴────────────┤
│                                                    │
│  [Contenido del tab seleccionado]                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Flujo de Usuario

```
Usuario ve RFP analizado
         │
         ▼
┌─────────────────────────┐
│ Tab "Equipo Estimado"   │
│                         │
│ Muestra roles, cantidad │
│ skills, certificaciones │
│ tarifas de mercado      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Tab "Costos"            │
│                         │
│ Desglose por rol        │
│ Comparacion presupuesto │
│ Alerta viabilidad       │
│ Recomendaciones         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Tab "Candidatos TIVIT"  │
│                         │
│ [Buscar Candidatos]     │ ◄─── Boton que llama a MCP
│                         │
│ Lista por rol           │
│ Score de match          │
│ Contacto y lider        │
└─────────────────────────┘
```

---

## Endpoints API

### GET /api/v1/rfp/{id}/team-estimation

Obtiene estimaciones guardadas.

**Response:**
```json
{
  "team_estimation": {...},
  "cost_estimation": {...},
  "suggested_team": {...}
}
```

### POST /api/v1/rfp/{id}/suggest-team

Busca candidatos en MCP.

**Query Params:**
- `force_refresh` (bool): Re-consulta MCP aunque haya resultados previos

**Response:**
```json
{
  "rfp_id": "uuid",
  "scenario": "A",
  "team_estimation": {...},
  "cost_estimation": {...},
  "suggested_team": {...},
  "message": "Encontrados 28 candidatos para 5 roles"
}
```

---

## Ejemplos de Uso

### Ejemplo 1: RFP con todo especificado (Escenario A)

```bash
# 1. Subir RFP
curl -X POST http://localhost:8000/api/v1/rfp/upload \
  -F "file=@licitacion_banco.pdf"

# Response: {"id": "abc-123", "status": "analyzing"}

# 2. Esperar analisis y ver resultado
curl http://localhost:8000/api/v1/rfp/abc-123

# Response incluye:
# - team_estimation con source: "client_specified"
# - cost_estimation con viability
# - scenario: "A"

# 3. Buscar candidatos
curl -X POST http://localhost:8000/api/v1/rfp/abc-123/suggest-team

# Response incluye:
# - suggested_team con candidatos reales
```

### Ejemplo 2: RFP sin personal ni presupuesto (Escenario D)

```bash
# 1. Subir RFP minimalista
curl -X POST http://localhost:8000/api/v1/rfp/upload \
  -F "file=@rfp_simple.pdf"

# 2. Ver analisis completo
curl http://localhost:8000/api/v1/rfp/xyz-789

# Response incluye:
# - team_estimation con source: "ai_estimated"
# - cost_estimation con presupuesto sugerido
# - scenario: "D"

# 3. Ver estimaciones detalladas
curl http://localhost:8000/api/v1/rfp/xyz-789/team-estimation
```

---

## Consideraciones Importantes

### Grounding (Google Search)

- **Obligatorio**: El sistema usa Google Search para tarifas actuales
- **Costo adicional**: ~$0.01 por busqueda de grounding
- **Latencia**: +2-3 segundos por analisis

### Precision

| Metrica | Target |
|---------|--------|
| Deteccion escenario | > 95% |
| Precision equipo | > 80% |
| Cobertura MCP | > 70% |

### Limitaciones

1. Tarifas son estimaciones basadas en busquedas web
2. No considera beneficios ni costos indirectos
3. MCP solo busca en base de datos TIVIT activa

---

## Documentacion Relacionada

- [README.md](../README.md) - Documentacion principal
- [PLAN_TEAM_ESTIMATION.md](PLAN_TEAM_ESTIMATION.md) - Plan de implementacion
- [MCP Docs](../mcp/docs/docs.md) - Documentacion del MCP

---

*Documento generado: Enero 2026*
