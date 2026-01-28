# Documentación Técnica: Módulos de Soporte a Propuestas (Certificaciones, Experiencias, Capítulos)

Este documento detalla la arquitectura, modelos de datos y endpoints de los módulos auxiliares utilizados para la generación de propuestas técnicas.

## Vision General

El sistema de generación de propuestas se nutre de tres fuentes de información principales para enriquecer el documento final:

1.  **Certificaciones**: Archivos DOCX preexistentes que validan competencias.
2.  **Experiencias**: Registros estructurados en base de datos sobre proyectos previos (Casos de Éxito).
3.  **Capítulos**: Bloques de texto/contenido estandarizado (Archivos DOCX) que se pueden ensamblar en la propuesta (ej. "Modelo de Gobierno", "Seguridad").

Estos módulos interactúan principalmente con el `ProposalGenerator` (`core/services/proposal_generator.py`) a través del endpoint `/proposal/generate`, donde se inyectan dinámicamente en el flujo de creación del documento DOCX.

---

## 1. Certificaciones (`/certifications`)

Gestión de archivos de certificación que se adjuntan o referencian en la propuesta.

### Modelo de Datos (`models/certification.py`)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Identificador único. |
| `name` | String | Nombre de la certificación (extraído por IA o nombre de archivo). |
| `description` | Text | Descripción breve. |
| `filename` | String | Nombre original del archivo subido. |
| `location` | String | URI o path donde está almacenado el archivo físico (File Storage). |
| `is_active` | Boolean | Estado de validez. |

### Endpoints Principales (`api/routes/certifications.py`)

*   **`GET /certifications/`**: Lista todas las certificaciones activas.
*   **`POST /certifications/save`**: 
    *   **Input**: `file` (UploadFile, .docx).
    *   **Proceso**:
        1.  Valida extensión y tamaño.
        2.  **Análisis IA** (`analyzer.analyze_certification_content`): Extrae nombre y valida que el contenido sea realmente una certificación.
        3.  Sube el archivo al Storage (`templates/certs`).
        4.  Guarda registro en BD.
*   **`GET /certifications/{id}/download`**: Descarga el archivo físico.
*   **`DELETE /certifications/{id}`**: Elimina el registro de la BD (actualmente Hard Delete).

---

## 2. Experiencias (`/experiences`)

Catálogo de casos de éxito o experiencias previas de la empresa. A diferencia de los otros módulos, este maneja **datos estructurados** en lugar de archivos puros.

### Modelo de Datos (`models/experience.py`)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Identificador único. |
| `propietario_servicio` | String | Cliente o dueño del servicio prestado. |
| `descripcion_servicio` | Text | Detalle de qué se realizó. |
| `ubicacion` | String | Lugar de ejecución. |
| `fecha_inicio` / `_fin` | Date | Rango de fechas del proyecto. |
| `monto_final` | Numeric | Valor económico del proyecto. |

### Endpoints Principales (`api/routes/experiences.py`)

*   **`GET /experiences/`**: Listado completo ordenado por fecha.
*   **`POST /experiences/`**: Creación manual de una experiencia (JSON Body).
*   **`PUT /experiences/{id}`**: Actualización de datos.
*   **`DELETE /experiences/{id}`**: Borrado lógico o físico.
*   **`POST /experiences/recommendations`** (IA Feature):
    *   **Input**: `rfp_id`.
    *   **Proceso**:
        1.  Obtiene el resumen del RFP (Request for Proposal).
        2.  Selecciona todas las experiencias de la BD.
        3.  **Análisis IA** (`analyzer.analyze_experience_relevance`): Compara semánticamente el requerimiento del RFP con las experiencias y devuelve una lista con `score` y `reason` para recomendarlas.

---

## 3. Capítulos (`/chapters`)

Repositorio de secciones de texto reutilizables (Boilerplate) para las propuestas.

### Modelo de Datos (`models/chapter.py`)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Identificador único. |
| `name` | String | Título del capítulo (ej. "Metodología Ágil"). |
| `description` | Text | Resumen del contenido. |
| `location` | String | URI del archivo DOCX fuente. |
| `is_active` | Boolean | Disponibilidad. |

### Endpoints Principales (`api/routes/chapters.py`)

*   **`GET /chapters/`**: Lista capítulos activos.
*   **`POST /chapters/save`**:
    *   **Input**: `file` (.docx).
    *   **Proceso**: Similar a certificaciones, usa IA (`analyzer.analyze_chapter_content`) para validar que el documento sea un texto coherente para una propuesta y extraer metadatos.
*   **`POST /chapters/recommendations`** (IA Feature):
    *   Funciona igual que en Experiencias. La IA analiza qué capítulos son pertinentes para el RFP actual y los sugiere.

---

## 4. Gestión de Licitaciones (RFP)

El núcleo del sistema gira en torno al manejo de **RFP Submissions**. Este módulo orquesta la carga, análisis y ciclo de vida de una licitación.

### Modelo de Datos (`models/rfp.py`)

La entidad principal es `RFPSubmission`, que actúa como contenedor del proyecto.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Identificador del proyecto. |
| `status` | Enum | PENDING -> ANALYZING -> ANALYZED -> GO/NO_GO. |
| `extracted_data` | JSONB | Resultado crudo del análisis IA (Resumen, Alcance, Stack, etc). |
| `confidence_score`| Int | Nivel de confianza del análisis (0-100). |
| `decision` | String | Decisión final del Manager (GO o NO GO). |
| `file_gcs_path` | String | Ruta "lógica" en el storage (ej. `multi_file_project`). |

**Relación con Archivos**: Un `RFPSubmission` tiene múltiples `Archivo`s asociados (PDFs, Excels, docs técnicos) que componen la licitación.

### Flujo de Carga (`api/routes/rfp.py`)

1.  **POST `/rfp/upload`**:
    *   Recibe una lista de archivos (`files`).
    *   **Conversión Automática**: Si un archivo es DOCX, se convierte a PDF en el vuelo para garantizar fidelidad en el análisis OCR/Vision.
    *   **Almacenamiento**: Guarda los archivos físicos mediante `StorageService`.
    *   **Registro**: Crea la entrada `RFPSubmission` y múltiples entradas `Archivo`.
    *   **Background Task**: Dispara `analyze_project_background_task` para no bloquear al usuario.

2.  **Análisis (Background)**:
    *   Recupera los archivos.
    *   Invoca a `AnalyzerService` (Gemini 1.5 Pro).
    *   Extrae metadatos clave (Cliente, Fechas, Presupuesto, Stack Tecnológico).
    *   Actualiza `rfp.extracted_data` y cambia status a `ANALYZED`.

3.  **Decisión (`POST /rfp/{id}/decision`)**:
    *   El usuario decide `GO` o `NO GO`.
    *   **Efecto**: Mueve los archivos a las carpetas correspondientes en el sistema de directorios del usuario (ver sección Storage) y habilita la etapa de Generación de Propuesta.

---

## 5. Generación de Propuestas (Engine)

Motor que ensambla el documento final (`.docx`) combinando plantillas, datos de BD y archivos adjuntos.

### Componente: `ProposalGeneratorService` (`core/services/proposal_generator.py`)

Utiliza `docxtpl` (Jinja2 para Word) para manipular una plantilla maestra (`tivit_proposal_template.docx`).

#### Flujo de Generación (`POST /proposal/generate`)

1.  **Preparación de Contexto (`prepare_context`)**:
    *   Combina datos del RFP extraído (Cliente, Acrónimo) con datos del Usuario.
    *   Formatea la lista de **Experiencias** seleccionadas como una lista de diccionarios para iterar en la plantilla.
    
2.  **Manejo de Sub-Documentos (Merge)**:
    *   Este es el paso más complejo. Para integrar **Certificaciones** y **Capítulos** (que son archivos DOCX completos), el generador:
        1.  Descarga los archivos desde el Storage temporalmente.
        2.  Usa `doc.new_subdoc()` para convertirlos en objetos insertables.
        3.  Inyecta estos sub-documentos en variables específicas del template (`{{certifications_section}}`, `{{chapters_section}}`).
    
3.  **Renderizado y Descarga**:
    *   Procesa las variables Jinja2.
    *   Genera un stream de bytes (`BytesIO`).
    *   Guarda una copia de respaldo en la carpeta `Proposals` del proyecto.
    *   Retorna el archivo al usuario ("Propuesta_Cliente_Fecha.docx").

---

## 6. Sistema de Archivos (Storage)

Capa de abstracción para el manejo de archivos y carpetas, simulando un File System jerárquico.

### Modelo de Datos (`models/storage.py`)

*   **`Carpeta`**: Estructura recursiva (`parent_id`).
*   **`Archivo`**: Referencia a un objeto físico (Blob) + Metadatos.
*   **`UsuarioCarpeta`**: Tabla intermedia para permisos/visibilidad.

### Estructura de Directorios

Al inicializar un usuario (`init_user_storage`), se crea:
*   `/Root` (Asociado al usuario)
    *   `/GO` (Proyectos aprobados)
        *   `/{TVT-ID}` (Carpeta del proyecto)
            *   `/Propuestas` (Versiones generadas)
    *   `/NO GO` (Proyectos rechazados)

### Servicio (`core/services/storage_service.py`)

*   **Abstracción**: Permite cambiar entre LocalStorage y Google Cloud Storage sin tocar el código de negocio.
*   **Gestión**: `create_folder`, `create_file`, `change_folder` (mover archivos).
*   **`upload_file` / `download_file`**: Métodos de bajo nivel para I/O de bytes.

---

## 7. Trazabilidad y Referencias a Documentos (`doc_X`)

Una característica clave del sistema es la capacidad del Modelo de IA para citar **evidencia real** en sus respuestas. Esto permite al usuario verificar de dónde salió cada dato extraído.

### Mecanismo de Identificación

1.  **Indexación en el Prompt**: 
    Al momento de analizar un proyecto Multi-Archivo (`analyze_rfp_project` en `analyzer.py`), el sistema asigna un ID secuencial estable a cada archivo.
    ```xml
    <rfp_project_files>
      <document id="doc_1" name="Bases_Administrativas.pdf" type="pdf">...</document>
      <document id="doc_2" name="Anexo_Tecnico.xlsx" type="xlsx">...</document>
    </rfp_project_files>
    ```

2.  **Solicitud de Cita**:
    El Prompt de sistema (`prompts/rfp_analysis.txt`) instruye explícitamente a Gemini para incluir la fuente de cada dato extraído en formato `[Fuente: doc_X, Pag Y]`.
    *   Ejemplo: `project_duration: "12 meses [Fuente: doc_1, Pag 14]"`

### Visualización en Frontend (UI)

Aunque este documento se enfoca en el backend, es importante notar cómo se consumen estos datos:

*   **API Response**: El JSON `extracted_data` que retorna el backend incluye estas cadenas de texto con citas.
*   **Mapeo**: El backend retorna la lista ordenada de archivos en `GET /rfp/{id}`. Como el orden de inserción se respeta, `files[0]` corresponde a `doc_1`.
*   **UX**: El frontend detecta el patrón `doc_X`, busca el archivo correspondiente en la lista y permite abrir el visualizador PDF en la página específica mencionada.
