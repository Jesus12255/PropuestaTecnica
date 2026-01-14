# Especificación Técnica: Módulo MCP de Búsqueda de Talento "Batch" (TIVIT)

## 1. Contexto y Objetivo
Estamos construyendo un sistema de **"Team Building Automatizado"** para licitaciones (RFP).
El flujo es el siguiente:
1.  **Input:** Un JSON complejo con el contexto de una licitación (extraído de un RFP).
2.  **Cerebro (Gemini/Claude):** Analiza el RFP y determina qué roles (Perfiles) se necesitan.
3.  **Brazos (MCP Server):** Recibe la lista de roles requerida, busca en la Base de Conocimiento (Vectorial) y cruza con la Base de RRHH (Relacional) para devolver personas reales con disponibilidad y contacto.

**Objetivo Actual:** Actualizar el servidor MCP (`mcp/server.py`) para soportar una búsqueda **por lotes (Batch Search)** que cruce dos fuentes de datos excel usando la `Matrícula` como llave primaria.

---

## 2. Fuentes de Datos

### A. "Excel Gigante" (Certificaciones/Habilidades)
* **Contenido:** Historial masivo de certificaciones y skills técnicos.
* **Formato:** Múltiples filas por empleado (Relación 1:N).
* **Columnas Clave:** `Matrícula` (ID), `Conhecimento` (Skill), `Certificação`, `País`.
* **Uso:** Indexación Vectorial (LanceDB) para búsqueda semántica (ej: "Sabe Java" -> encuentra "Spring Boot").

### B. "Excel RRHH" (Datos Organizacionales)
* **Contenido:** Datos administrativos y jerarquía.
* **Formato:** Una fila por empleado activo (Relación 1:1).
* **Columnas Clave:** `Matrícula` (ID), `Colaborador`, `Email`, `Cargo`, `Nome do Líder`, `Email do Líder`.
* **Uso:** Enriquecimiento de datos (JOIN) y filtrado de ejecutivos (Whitelist).

---

## 3. Requerimientos Funcionales del MCP

El servidor debe exponer una nueva herramienta (Tool) llamada `buscar_equipo_completo` con la siguiente lógica interna:

### Lógica de la Tool `buscar_equipo_completo`
**Input:** Un JSON Array con los perfiles requeridos.
```json
[
  {"rol_id": "PM_Senior", "descripcion": "Project Manager PMP Scrum Master", "pais": "Chile"},
  {"rol_id": "Dev_Backend", "descripcion": "Java Spring Microservicios", "pais": "Chile"}
]
Proceso Interno (Paso a Paso):

Iteración: Recorre cada rol solicitado en el input.

Búsqueda Vectorial (LanceDB):

Usa sentence-transformers para convertir la descripcion en vector.

Busca los Top-N candidatos semánticos en la tabla de Certificaciones.

Filtro 1: Filtrar por País (si viene en el input).

Cruce de Datos (Pandas Join):

Toma las Matrículas encontradas en el paso anterior.

Hace un INNER JOIN con el DataFrame de RRHH.

Importante: Si la matrícula no está en RRHH (ej: empleado desvinculado), se descarta.

Agrupación y Limpieza:

Agrupa los resultados por Matrícula.

Selecciona al mejor candidato basado en el _distance (score) del vector.

Estructura la respuesta con los datos de contacto del empleado y su líder.

Output: Un JSON estructurado agrupado por rol.

JSON

{
  "PM_Senior": [
    {
      "nombre": "Juan Pérez",
      "email": "juan@tivit.com",
      "match_skill": "PMP Certified 2024",
      "lider": "Maria Jefe",
      "score": 0.95
    }
  ]
}
4. Stack Tecnológico Actual
Framework: mcp (Model Context Protocol), fastapi.

Datos: pandas (para manejo de Excel), lancedb (Vector Store embebido).

AI: sentence-transformers (modelo paraphrase-multilingual-MiniLM-L12-v2).

5. Instrucciones de Implementación (Código)
Por favor, refactoriza mcp/server.py para incluir:

Modelos Pydantic Robustos: Define RequerimientoRol y BatchSearchRequest para validar la entrada.

Carga Inteligente:

Implementa load_rrhh_data() con cache (variable global) para no leer el Excel de RRHH en cada petición.

Asegura que initialize_vector_db() guarde la matricula como campo metadata en LanceDB.

La Tool buscar_equipo_completo: Debe ser capaz de recibir N roles y devolver N listas de candidatos en una sola llamada (para reducir latencia).

Prompt de Sistema Sugerido (Para el LLM): Incluye un comentario en el código con el System Prompt que debería usar Gemini/Claude para invocar esta herramienta correctamente (instruyéndole a extraer hard skills y certificaciones del RFP).

Nota Final: El objetivo es que la IA "Cerebro" entienda el negocio, y este MCP actúe como una "API de Staffing Inteligente" que devuelve datos listos para contactar.

---