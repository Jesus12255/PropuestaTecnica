# PRD: MCP Talent Search - Sistema de Búsqueda Semántica de Talento

## Información del Documento

| Campo | Valor |
|-------|-------|
| **Producto** | MCP Talent Search API |
| **Versión** | 3.0.0 |
| **Fecha** | Enero 2026 |
| **Estado** | En Desarrollo |
| **Owner** | TIVIT - Equipo de Innovación |

---

## 1. Resumen Ejecutivo

### 1.1 Visión del Producto

MCP Talent Search es un sistema de **búsqueda semántica de talento** que permite encontrar candidatos idóneos dentro de la base de datos de colaboradores de TIVIT, cruzando certificaciones verificadas, skills técnicos y datos organizacionales.

El sistema está diseñado para automatizar el proceso de **Team Building** en licitaciones (RFP), permitiendo a los equipos comerciales identificar rápidamente a las personas con las competencias requeridas para cada proyecto.

### 1.2 Problema que Resuelve

| Problema Actual | Impacto | Solución Propuesta |
|-----------------|---------|-------------------|
| Búsqueda manual de CVs en Excel | Horas de trabajo por cada RFP | Búsqueda semántica en segundos |
| Información desactualizada de skills | Propuestas con personal no disponible | Filtros automáticos de status activo |
| Dificultad para matchear requisitos técnicos | Pérdida de licitaciones | IA interpreta lenguaje natural |
| Datos dispersos en múltiples fuentes | Inconsistencia en propuestas | Cruce automático de bases de datos |

### 1.3 Propuesta de Valor

> **"De un RFP a un equipo propuesto en menos de 1 minuto"**

El sistema permite que un agente de IA (Gemini/Claude) analice un documento RFP, extraiga los roles requeridos, y automáticamente busque y proponga candidatos reales con información de contacto verificada.

---

## 2. Objetivos y Métricas de Éxito

### 2.1 Objetivos del Producto

| Objetivo | Descripción | Prioridad |
|----------|-------------|-----------|
| **O1** | Reducir tiempo de armado de equipos de 4 horas a 5 minutos | Alta |
| **O2** | Aumentar precisión de matching de skills en propuestas | Alta |
| **O3** | Centralizar información de certificaciones y skills | Media |
| **O4** | Habilitar consultas en lenguaje natural | Media |
| **O5** | Integrar con flujo de trabajo de licitaciones | Baja |

### 2.2 KPIs y Métricas

| Métrica | Baseline | Target | Método de Medición |
|---------|----------|--------|-------------------|
| Tiempo de armado de equipo | 4 horas | 5 minutos | Cronómetro en proceso |
| Precisión de matching | 60% | 90% | Feedback de comerciales |
| Uso del sistema | 0 | 50 consultas/semana | Logs del servidor |
| Satisfacción de usuarios | N/A | >4.0/5.0 | Encuestas |

---

## 3. Usuarios y Stakeholders

### 3.1 Usuarios Primarios

#### Ejecutivos Comerciales
- **Rol**: Arman propuestas técnicas para licitaciones
- **Necesidad**: Encontrar rápidamente personal calificado para RFPs
- **Uso típico**: "Necesito 5 desarrolladores Java senior para un proyecto en Chile"

#### Agentes de IA (Gemini/Claude)
- **Rol**: Automatizan el análisis de RFPs
- **Necesidad**: API estructurada para búsqueda de talento
- **Uso típico**: Invocar `buscar_equipo_completo` con roles extraídos del RFP

### 3.2 Usuarios Secundarios

#### Recursos Humanos
- **Rol**: Mantienen actualizada la base de certificaciones
- **Necesidad**: Visualizar estadísticas de skills disponibles
- **Uso típico**: Consultar `/stats` para ver distribución de competencias

#### Líderes Técnicos
- **Rol**: Validan la idoneidad de candidatos propuestos
- **Necesidad**: Ver perfil completo de cada candidato
- **Uso típico**: Revisar certificaciones y skills de candidatos sugeridos

### 3.3 Stakeholders

| Stakeholder | Interés | Influencia |
|-------------|---------|------------|
| Gerencia Comercial | ROI en proceso de licitaciones | Alta |
| RRHH | Calidad de datos de empleados | Media |
| TI | Integración con sistemas existentes | Media |
| Legal | Cumplimiento de privacidad de datos | Baja |

---

## 4. Alcance del Producto

### 4.1 Funcionalidades Incluidas (In-Scope)

#### MVP (Versión 3.0)

| ID | Funcionalidad | Descripción | Estado |
|----|---------------|-------------|--------|
| F01 | Búsqueda semántica | Encontrar candidatos por descripción en lenguaje natural | ✅ Implementado |
| F02 | Perfiles enriquecidos | Retornar TODAS las certificaciones y skills de cada candidato | ✅ Implementado |
| F03 | Batch search | Buscar múltiples roles en una sola llamada | ✅ Implementado |
| F04 | Chat con Gemini | Interpretar consultas en lenguaje natural | ✅ Implementado |
| F05 | Filtro por país | Limitar búsqueda a un país específico | ✅ Implementado |
| F06 | Información de líder | Incluir datos del líder directo de cada candidato | ✅ Implementado |
| F07 | API REST | Endpoints HTTP para integración | ✅ Implementado |
| F08 | Protocolo MCP | Herramientas para agentes de IA | ✅ Implementado |
| F09 | Documentación Swagger | OpenAPI en /docs | ✅ Implementado |
| F10 | Suite de tests | Tests automatizados | ✅ Implementado |

#### Futuras Versiones

| ID | Funcionalidad | Descripción | Versión |
|----|---------------|-------------|---------|
| F11 | Disponibilidad en tiempo real | Integrar con sistema de asignaciones | 4.0 |
| F12 | Scoring de fit | Calcular porcentaje de match con requisitos | 4.0 |
| F13 | Histórico de propuestas | Guardar equipos propuestos anteriormente | 4.0 |
| F14 | Notificaciones a líderes | Alertar cuando su personal es propuesto | 4.0 |
| F15 | UI Web | Interfaz gráfica para usuarios no técnicos | 5.0 |

### 4.2 Funcionalidades Excluidas (Out-of-Scope)

| Funcionalidad | Razón de Exclusión |
|---------------|-------------------|
| Gestión de CVs | Ya existe en otro sistema |
| Tracking de licitaciones | Fuera del alcance del producto |
| Evaluación de desempeño | Datos sensibles de RRHH |
| Contratación de externos | Solo personal interno |

---

## 5. Requisitos Funcionales

### 5.1 RF01: Búsqueda Semántica de Talento

**Descripción**: El sistema debe permitir buscar candidatos usando descripciones en lenguaje natural, encontrando matches por significado semántico (no solo palabras exactas).

**Criterios de Aceptación**:
- [ ] Buscar "Java Spring" debe encontrar personas con "Spring Boot", "Spring Framework", etc.
- [ ] Buscar en español debe encontrar datos en portugués (multilingüe)
- [ ] Retornar score de similitud entre 0 y 1
- [ ] Limitar resultados según parámetro `limit`

**Ejemplo de Request**:
```json
POST /search
{
  "consulta": "Desarrollador Java con experiencia en microservicios",
  "limit": 5,
  "pais": "Chile"
}
```

### 5.2 RF02: Perfiles Enriquecidos

**Descripción**: Cada candidato retornado debe incluir TODAS sus certificaciones y skills, no solo el que hizo match.

**Criterios de Aceptación**:
- [ ] Incluir lista completa de certificaciones del candidato
- [ ] Incluir lista completa de skills con nivel de proficiencia
- [ ] Incluir información del líder directo
- [ ] Incluir el skill/certificación que generó el match

**Ejemplo de Response**:
```json
{
  "matricula": "12345",
  "nombre": "Juan Pérez",
  "email": "juan.perez@tivit.com",
  "cargo": "Senior Developer",
  "certificaciones": [
    {"nombre": "AWS Solutions Architect", "institucion": "Amazon"},
    {"nombre": "Java SE 11 Developer", "institucion": "Oracle"}
  ],
  "skills": [
    {"nombre": "Java", "proficiencia": 5},
    {"nombre": "Kubernetes", "proficiencia": 4}
  ],
  "lider": {
    "nombre": "María Jefe",
    "email": "maria.jefe@tivit.com"
  },
  "match_principal": "Java SE 11 Developer",
  "score": 0.89
}
```

### 5.3 RF03: Búsqueda Batch (Equipo Completo)

**Descripción**: Permitir buscar candidatos para múltiples roles en una sola llamada, optimizando el proceso de Team Building.

**Criterios de Aceptación**:
- [ ] Aceptar lista de roles con descripción y cantidad
- [ ] Retornar candidatos agrupados por rol
- [ ] Deduplicar candidatos que aparezcan en múltiples roles
- [ ] Soportar filtro de país por rol

**Ejemplo de Request**:
```json
POST /batch-search
{
  "roles": [
    {"rol_id": "PM", "descripcion": "Project Manager PMP", "cantidad": 1},
    {"rol_id": "Dev", "descripcion": "Java Spring", "cantidad": 3},
    {"rol_id": "DBA", "descripcion": "Oracle Database", "cantidad": 1}
  ]
}
```

### 5.4 RF04: Chat con Lenguaje Natural

**Descripción**: Endpoint que usa Gemini para interpretar consultas en lenguaje natural y ejecutar búsquedas automáticamente.

**Criterios de Aceptación**:
- [ ] Interpretar cantidad de personas requeridas
- [ ] Extraer skills y certificaciones mencionadas
- [ ] Detectar país si se menciona
- [ ] Expandir términos técnicos relacionados
- [ ] Generar respuesta en lenguaje natural

**Ejemplo de Request**:
```json
POST /chat
{
  "mensaje": "Necesito armar un equipo de 5 personas para migrar a la nube en Colombia"
}
```

### 5.5 RF05: Filtros Automáticos de Calidad

**Descripción**: El sistema debe aplicar automáticamente filtros para garantizar calidad de datos.

**Criterios de Aceptación**:
- [ ] Solo incluir certificaciones con Status = "Verificado"
- [ ] Solo incluir certificaciones no expiradas (Expirado = "Nao")
- [ ] Solo incluir colaboradores activos (Status = "Ativo")
- [ ] No requerir que el usuario especifique estos filtros

---

## 6. Requisitos No Funcionales

### 6.1 Rendimiento

| Métrica | Requisito |
|---------|-----------|
| Tiempo de respuesta /search | < 2 segundos |
| Tiempo de respuesta /batch-search | < 5 segundos |
| Tiempo de respuesta /chat | < 10 segundos |
| Inicialización del servidor | < 60 segundos |
| Usuarios concurrentes | 10 |

### 6.2 Disponibilidad

| Métrica | Requisito |
|---------|-----------|
| Uptime | 99% (horario laboral) |
| Tiempo de recuperación | < 5 minutos |
| Backup de índices | Diario |

### 6.3 Seguridad

| Aspecto | Requisito |
|---------|-----------|
| Autenticación | API Key (futuro: OAuth2) |
| Datos sensibles | No exponer salarios ni datos personales sensibles |
| Logs | Registrar todas las consultas |
| CORS | Configurar orígenes permitidos |

### 6.4 Escalabilidad

| Aspecto | Requisito |
|---------|-----------|
| Registros soportados | 500,000 certificaciones |
| Skills soportados | 1,000,000 registros |
| Modelo de embeddings | Cargado en memoria (singleton) |
| Base vectorial | LanceDB (local, escalable a cloud) |

---

## 7. Arquitectura Técnica

### 7.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Frontend  │  │  Agente IA  │  │   Backend   │                  │
│  │   (futuro)  │  │   Gemini    │  │   TIVIT     │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          │                                           │
│                          ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    API REST (FastAPI)                          │  │
│  │                    Puerto: 8083                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │ /search  │  │ /batch-  │  │  /chat   │  │   /health    │   │  │
│  │  │          │  │  search  │  │ (Gemini) │  │   /stats     │   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────────┘   │  │
│  │       │             │             │                            │  │
│  │       └─────────────┼─────────────┘                            │  │
│  │                     │                                          │  │
│  │                     ▼                                          │  │
│  │  ┌───────────────────────────────────────────────────────┐    │  │
│  │  │              search_and_enrich()                       │    │  │
│  │  │  1. Búsqueda vectorial en LanceDB                     │    │  │
│  │  │  2. Deduplicación por matrícula                       │    │  │
│  │  │  3. Enriquecimiento con todas las certs/skills        │    │  │
│  │  │  4. Obtención de info del líder                       │    │  │
│  │  └───────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    LanceDB      │ │    LanceDB      │ │  Gemini API     │
│ Certificaciones │ │     Skills      │ │  (Google)       │
│   (vectores)    │ │   (vectores)    │ │                 │
└────────┬────────┘ └────────┬────────┘ └─────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FUENTES DE DATOS                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌───────────────────────────────┐   │
│  │  Capital_Intelectual.xlsx │  │       Census.xlsx             │   │
│  │  (Certificaciones)        │  │    (Skills + RRHH)            │   │
│  │  - 9,185 registros        │  │    - 298,650 registros        │   │
│  │  - Relación 1:N           │  │    - Relación 1:N             │   │
│  └───────────────────────────┘  └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Stack Tecnológico

| Componente | Tecnología | Versión | Justificación |
|------------|------------|---------|---------------|
| **Runtime** | Python | 3.10+ | Ecosistema ML maduro |
| **API Framework** | FastAPI | 0.100+ | Async, OpenAPI automático |
| **Vector DB** | LanceDB | 0.4+ | Embebido, sin servidor |
| **Embeddings** | Sentence Transformers | 2.2+ | Modelos multilingües |
| **Modelo** | paraphrase-multilingual-MiniLM-L12-v2 | - | PT/ES/EN |
| **LLM** | Gemini 2.5 Flash | - | Velocidad + capacidad |
| **Data** | Pandas | 2.0+ | Procesamiento de Excel |
| **Protocolo** | MCP | 0.1+ | Integración con agentes |

### 7.3 Modelo de Datos

#### Certificación (Capital_Intelectual.xlsx)
```
┌─────────────────────────────────────────────────────────────┐
│ Campo                        │ Tipo     │ Descripción       │
├─────────────────────────────────────────────────────────────┤
│ [Colaborador] Matricula      │ String   │ ID del empleado   │
│ [Colaborador] Nome           │ String   │ Nombre completo   │
│ [Colaborador] Email          │ String   │ Email corporativo │
│ [Colaborador] Cargo          │ String   │ Cargo actual      │
│ [Colaborador] País           │ String   │ País de trabajo   │
│ Certificação                 │ String   │ Nombre de la cert │
│ Instituição                  │ String   │ Entidad emisora   │
│ Status                       │ String   │ Verificado/Reprov │
│ Expirado                     │ String   │ Nao/Sim           │
│ Data de emissão              │ Date     │ Fecha de emisión  │
│ [Liderança] Nome             │ String   │ Nombre del líder  │
│ [Liderança] Email            │ String   │ Email del líder   │
└─────────────────────────────────────────────────────────────┘
```

#### Skill (Census.xlsx)
```
┌─────────────────────────────────────────────────────────────┐
│ Campo                        │ Tipo     │ Descripción       │
├─────────────────────────────────────────────────────────────┤
│ Matrícula                    │ String   │ ID del empleado   │
│ Colaborador                  │ String   │ Nombre completo   │
│ Email                        │ String   │ Email corporativo │
│ Cargo                        │ String   │ Cargo actual      │
│ Conhecimento                 │ String   │ Nombre del skill  │
│ Categoria                    │ String   │ Categoría técnica │
│ Nível de Proficiência        │ Integer  │ 1-5               │
│ Status Colaborador           │ String   │ Ativo/Inativo     │
│ Nome do Líder                │ String   │ Nombre del líder  │
│ Email do Líder               │ String   │ Email del líder   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Flujos de Usuario

### 8.1 Flujo Principal: Team Building para RFP

```
┌─────────────────────────────────────────────────────────────────────┐
│ ACTOR: Ejecutivo Comercial + Agente IA                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Ejecutivo sube documento RFP al sistema de análisis              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Agente IA (Gemini) analiza el RFP y extrae:                      │
│    - Roles requeridos (PM, Desarrolladores, DBAs, etc.)             │
│    - Skills/certificaciones necesarias                              │
│    - Cantidad de personas por rol                                   │
│    - País o ubicación requerida                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Agente invoca MCP Tool: buscar_equipo_completo                   │
│    Input: [                                                          │
│      {"rol_id": "PM", "descripcion": "PMP Scrum", "cantidad": 1},   │
│      {"rol_id": "Dev", "descripcion": "Java Spring", "cantidad": 5} │
│    ]                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Sistema retorna candidatos con perfil completo:                  │
│    - Nombre, email, cargo                                           │
│    - TODAS las certificaciones                                      │
│    - TODOS los skills con proficiencia                              │
│    - Información del líder (para coordinación)                      │
│    - Score de match                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Agente presenta propuesta de equipo al Ejecutivo                 │
│    - Resume calificaciones de cada candidato                        │
│    - Destaca certificaciones relevantes al RFP                      │
│    - Provee datos de contacto del líder                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Ejecutivo valida propuesta y contacta líderes                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Flujo Alternativo: Consulta Directa

```
Usuario: "Necesito 3 desarrolladores Python para Brasil"
                              │
                              ▼
                    POST /chat
                    {"mensaje": "..."}
                              │
                              ▼
                  Gemini interpreta:
                  - cantidad: 3
                  - skill: Python Django Flask
                  - país: Brasil
                              │
                              ▼
                  Búsqueda semántica
                              │
                              ▼
                  Respuesta con candidatos
                  + respuesta en lenguaje natural
```

---

## 9. Riesgos y Mitigaciones

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|--------------|---------|------------|
| R1 | Datos desactualizados en Excel | Alta | Alto | Proceso de sincronización periódica |
| R2 | API Key de Gemini expuesta | Media | Alto | Usar variables de entorno, no hardcodear |
| R3 | Modelo de embeddings muy pesado | Baja | Medio | Cargar una sola vez (singleton) |
| R4 | Resultados irrelevantes | Media | Alto | Tuning de threshold de similitud |
| R5 | Sobrecarga del servidor | Baja | Medio | Rate limiting, caché de resultados |
| R6 | Privacidad de datos de empleados | Media | Alto | Solo exponer datos públicos corporativos |

---

## 10. Plan de Implementación

### 10.1 Fases

| Fase | Entregable | Duración | Estado |
|------|------------|----------|--------|
| **Fase 1** | MVP con búsqueda semántica básica | 2 semanas | ✅ Completado |
| **Fase 2** | Perfiles enriquecidos + Batch search | 1 semana | ✅ Completado |
| **Fase 3** | Integración con Gemini | 1 semana | ✅ Completado |
| **Fase 4** | Tests automatizados + Documentación | 1 semana | ✅ Completado |
| **Fase 5** | Piloto con usuarios reales | 2 semanas | Pendiente |
| **Fase 6** | Integración con sistema de RFPs | 4 semanas | Pendiente |

### 10.2 Dependencias

```
Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5 ──► Fase 6
                         │
                         ▼
                   GOOGLE_API_KEY
                   configurada
```

---

## 11. Apéndices

### A. Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /health | Estado del servicio |
| GET | /docs | Documentación Swagger |
| GET | /countries | Países disponibles |
| GET | /stats | Estadísticas del sistema |
| POST | /search | Búsqueda simple |
| POST | /batch-search | Búsqueda por roles |
| POST | /chat | Consulta en lenguaje natural |
| POST | /reindex | Reconstruir índices |

### B. Variables de Entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| GOOGLE_API_KEY | Sí (para /chat) | - | API Key de Gemini |
| GEMINI_MODEL | No | gemini-2.5-flash-preview-05-20 | Modelo de Gemini |
| MCP_PORT | No | 8083 | Puerto del servidor |
| MCP_MODE | No | http | Modo: http o mcp |

### C. Estructura de Archivos

```
mcp/
├── server.py                 # Servidor principal
├── requirements.txt          # Dependencias
├── README.md                 # Documentación de uso
├── PRD.md                    # Este documento
├── .env.example              # Template de configuración
├── Capital_Intelectual.xlsx  # Base de certificaciones
├── Census.xlsx               # Base de skills/RRHH
├── lancedb_data/             # Índices vectoriales (generado)
└── tests/                    # Suite de tests
    ├── config.py
    ├── test_direct.py
    ├── test_01_health.py
    ├── test_02_search.py
    ├── test_03_batch.py
    ├── test_04_chat.py
    └── run_all_tests.py
```

### D. Contacto

| Rol | Nombre | Email |
|-----|--------|-------|
| Product Owner | [Por definir] | - |
| Tech Lead | [Por definir] | - |
| Soporte | Equipo de Innovación | innovacion@tivit.com |

---

*Documento generado automáticamente - MCP Talent Search v3.0*
