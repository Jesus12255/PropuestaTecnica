# Guia de Uso - Sistema de CVs en MCP Talent Search

## Descripcion General

El sistema MCP Talent Search v4.0 ahora incluye busqueda semantica en CVs. Esto permite encontrar candidatos no solo por sus certificaciones y skills registradas en Excel, sino tambien por el contenido de sus CVs (experiencia, proyectos, tecnologias mencionadas, etc.).

**Novedades v4.1 - Vision OCR:**
- Extraccion automatica de texto de imagenes en CVs usando **Gemini 2.0 Flash**
- Detecta certificaciones, badges, logos con texto, diplomas, etc.
- Cache inteligente para no reprocesar imagenes ya analizadas

---

## Estructura de Archivos

```
mcp/
├── cvs/                          # Carpeta donde se colocan los CVs
│   ├── NOMBRE COMPLETO.pdf       # CVs en formato PDF
│   ├── NOMBRE COMPLETO.docx      # CVs en formato Word
│   └── README.md                 # Instrucciones basicas
├── cv_mapping_review.xlsx        # Archivo generado con estado del matching
├── cv_mapping_manual.xlsx        # Archivo para correcciones manuales (opcional)
├── cv_matcher.py                 # Logica de fuzzy matching
├── cv_processor.py               # Extraccion de texto de PDFs/DOCX
├── cv_vision.py                  # [NUEVO] OCR de imagenes con Gemini Vision
├── vision_cache.json             # [NUEVO] Cache de imagenes procesadas
└── server.py                     # Servidor principal
```

---

## Como Agregar CVs

### Paso 1: Nombrar los archivos correctamente

Los CVs deben nombrarse con el **nombre completo del colaborador** tal como aparece en el sistema Census (RRHH).

**Formato correcto:**
```
NOMBRE COMPLETO EN MAYUSCULAS.pdf
NOMBRE COMPLETO EN MAYUSCULAS.docx
```

**Ejemplos:**
```
JUAN PABLO GARCIA MARTINEZ.pdf
MARIA FERNANDA LOPEZ RODRIGUEZ.docx
CARLOS ANDRES PEREZ SILVA.pdf
```

**Formatos soportados:** `.pdf`, `.docx`, `.doc`

### Paso 2: Colocar los archivos en la carpeta

Copiar los CVs a la carpeta:
```
mcp/cvs/
```

### Paso 3: Reiniciar el servidor o reindexar

**Opcion A - Reiniciar servidor:**
```bash
# Detener el servidor (Ctrl+C)
# Volver a iniciar
python server.py
```

**Opcion B - Reindexar sin reiniciar:**
```bash
curl -X POST "http://localhost:8080/reindex-cvs"
```

---

## Proceso de Matching Automatico

Cuando el servidor inicia, ejecuta un proceso de **fuzzy matching** que intenta vincular cada CV con una matricula del sistema.

### Estados del Matching

| Estado | Simbolo | Significado | Accion Requerida |
|--------|---------|-------------|------------------|
| **Automatico** | `[OK]` | Match >= 80% de confianza | Ninguna - listo para usar |
| **Revisar** | `[??]` | Match entre 60-79% | Verificar manualmente |
| **No encontrado** | `[XX]` | Match < 60% o no existe | Correccion manual requerida |

### Ejemplo de salida en consola:

```
[OK] JUAN PABLO GARCIA MARTINEZ.pdf      -> 40004296   (100.0%)
[??] MARIA FERNANDA LOPEZ.pdf            -> 40004012   (69.1%)
[XX] CARLOS PEREZ.pdf                    -> N/A        (58.2%)
```

---

## Archivo cv_mapping_review.xlsx

Despues de cada inicio, se genera/actualiza el archivo `cv_mapping_review.xlsx` con el estado de todos los CVs.

### Columnas del archivo:

| Columna | Descripcion |
|---------|-------------|
| `cv_filename` | Nombre del archivo CV |
| `matricula_sugerida` | Matricula que el sistema sugirio |
| `nombre_sugerido` | Nombre del colaborador en Census |
| `confianza` | Porcentaje de match (0-100) |
| `estado` | `auto`, `revisar`, o `no_encontrado` |
| `matricula_correcta` | **Dejar vacio o corregir manualmente** |

---

## Que Hacer Segun el Estado

### Caso 1: Match Automatico (100% o muy alto)

**Ejemplo en consola:**
```
[OK] ALVARO ANDRES BAENA ARBOLEDA.pdf    -> 40004296   (100.0%)
```

**Accion:** Ninguna. El sistema ya vinculo correctamente el CV con la matricula.

**En el Excel `cv_mapping_review.xlsx`:**
- `estado` = `auto`
- `confianza` = 95-100%
- No necesita modificacion

---

### Caso 2: Requiere Revision (60-79%)

**Ejemplo en consola:**
```
[??] DIANA CAROLINA SOTELO HUERTAS.pdf   -> 40004012   (69.1%)
```

**Accion:** Verificar si la matricula sugerida es correcta.

**Pasos:**
1. Abrir `cv_mapping_review.xlsx`
2. Buscar la fila con `estado` = `revisar`
3. Comparar `nombre_sugerido` con el nombre del archivo CV
4. **Si es correcto:** Copiar `matricula_sugerida` a `matricula_correcta`
5. **Si es incorrecto:** Buscar la matricula correcta en Census.xlsx y escribirla en `matricula_correcta`

**Ejemplo en Excel:**

| cv_filename | matricula_sugerida | nombre_sugerido | confianza | estado | matricula_correcta |
|-------------|-------------------|-----------------|-----------|--------|-------------------|
| DIANA CAROLINA SOTELO HUERTAS.pdf | 40004012 | DIANA CAROLINA SOTELO MORENO | 69.1% | revisar | 40004567 |

---

### Caso 3: No Encontrado (< 60%)

**Ejemplo en consola:**
```
[XX] JENNER JOSE FUENTES ESPINOZA.pdf    -> N/A        (58.2%)
```

**Accion:** Buscar manualmente la matricula correcta.

**Pasos:**
1. Abrir `cv_mapping_review.xlsx`
2. Buscar la fila con `estado` = `no_encontrado`
3. Abrir `Census.xlsx` y buscar al colaborador por nombre
4. Copiar la matricula encontrada a la columna `matricula_correcta`

**Posibles razones:**
- El colaborador ya no esta activo en el sistema
- El nombre en el CV es muy diferente al registrado
- Errores de tipeo en el nombre del archivo

**Ejemplo en Excel:**

| cv_filename | matricula_sugerida | nombre_sugerido | confianza | estado | matricula_correcta |
|-------------|-------------------|-----------------|-----------|--------|-------------------|
| JENNER JOSE FUENTES ESPINOZA.pdf | | | 58.2% | no_encontrado | 50000999 |

---

## Aplicar Correcciones Manuales

### Paso 1: Crear archivo de correcciones

Guardar las correcciones en un archivo llamado `cv_mapping_manual.xlsx` con el formato:

| cv_filename | matricula |
|-------------|-----------|
| DIANA CAROLINA SOTELO HUERTAS.pdf | 40004567 |
| JENNER JOSE FUENTES ESPINOZA.pdf | 50000999 |

**Nota:** Solo incluir los CVs que necesitan correccion.

### Paso 2: Reindexar

```bash
curl -X POST "http://localhost:8080/reindex-cvs"
```

El sistema:
1. Lee primero `cv_mapping_manual.xlsx` (si existe)
2. Usa esas matriculas como prioridad
3. Aplica fuzzy matching solo a los CVs no especificados manualmente

---

## Verificar Estado del Sistema

### Health Check

```bash
curl "http://localhost:8080/health"
```

Respuesta:
```json
{
  "status": "healthy",
  "version": "4.0.0",
  "total_cvs": 28,
  "total_cv_chunks": 422
}
```

### Ver Mapping Actual

```bash
curl "http://localhost:8080/cvs/mapping-review"
```

Muestra el estado actual de todos los CVs y sus matriculas asignadas.

---

## Busqueda con CVs

### Endpoint de Busqueda

```bash
curl -X POST "http://localhost:8080/search" \
  -H "Content-Type: application/json" \
  -d '{"consulta": "Java Spring Boot", "limit": 5}'
```

### Respuesta con datos de CV

```json
{
  "candidatos": [
    {
      "matricula": "30009223",
      "nombre": "RAUL FRANCISCO SAAVEDRA",
      "tiene_cv": true,
      "cv_filename": "RAUL FRANCISCO SAAVEDRA VILLANUEVA.docx",
      "cv_matches": [
        {
          "texto": "Experiencia en desarrollo Java con Spring Boot...",
          "pagina": 2,
          "score": 85.5
        }
      ]
    }
  ]
}
```

### Campos nuevos en la respuesta

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `tiene_cv` | boolean | `true` si el candidato tiene CV disponible |
| `cv_filename` | string | Nombre del archivo CV |
| `cv_matches` | array | Fragmentos del CV que matchean con la busqueda |
| `cv_matches[].texto` | string | Extracto del texto (max 300 chars) |
| `cv_matches[].pagina` | int/null | Numero de pagina (null para DOCX) |
| `cv_matches[].score` | float | Score de similitud (0-100) |

---

## Descargar CV de un Candidato

```bash
# Por matricula
curl "http://localhost:8080/cvs/download/30009223" -o cv_candidato.docx

# El servidor retorna el archivo con el nombre original
```

---

## Resolucion de Problemas

### El CV no aparece en las busquedas

1. Verificar que el archivo esta en `mcp/cvs/`
2. Verificar que el formato es `.pdf`, `.docx` o `.doc`
3. Revisar `cv_mapping_review.xlsx` - puede estar como `no_encontrado`
4. Ejecutar reindexacion: `curl -X POST "http://localhost:8080/reindex-cvs"`

### El matching es incorrecto

1. Crear/editar `cv_mapping_manual.xlsx` con la correccion
2. Ejecutar reindexacion

### Error "Out of range float values"

Este bug fue corregido en v4.0. Si aparece, actualizar `server.py` a la ultima version.

### El servidor tarda mucho en iniciar

Es normal. El proceso incluye:
- Cargar modelo de embeddings (~5-10 seg)
- Leer Census.xlsx (~20-25 seg para 300K filas)
- Generar fuzzy matching de CVs (~5 seg)
- Total esperado: 30-40 segundos

---

## Estadisticas Actuales

Ejecutar para ver estadisticas:

```bash
curl "http://localhost:8080/stats"
```

Respuesta ejemplo:
```json
{
  "certificaciones": 7364,
  "skills_unicos": 244732,
  "colaboradores": 2066,
  "cvs_indexados": 28,
  "chunks_cv": 422
}
```

---

## Resumen de Endpoints Relacionados con CVs

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/health` | Estado del sistema incluyendo CVs |
| GET | `/cvs/download/{matricula}` | Descargar CV de un candidato |
| GET | `/cvs/mapping-review` | Ver estado del mapping de CVs |
| POST | `/reindex-cvs` | Reindexar solo CVs (sin reiniciar) |
| POST | `/search` | Busqueda que incluye CVs automaticamente |

---

## Vision OCR - Extraccion de Texto de Imagenes

### Que es Vision OCR?

El sistema ahora puede extraer texto de **imagenes** dentro de los CVs usando **Gemini 2.0 Flash** con capacidades de vision. Esto permite detectar:

- Certificaciones como badges (AWS, Azure, Google Cloud, Scrum, PMP)
- Logos de empresas o tecnologias con texto
- Diplomas y titulos academicos escaneados
- Screenshots de cursos o capacitaciones
- Cualquier texto relevante en formato imagen

### Como funciona?

1. **Extraccion de imagenes:** PyMuPDF extrae las imagenes del PDF/DOCX
2. **Filtrado:** Se ignoran imagenes muy pequenas (< 5KB) como iconos o bullets
3. **Analisis con Gemini:** Cada imagen se envia a Gemini Flash Vision
4. **Cache:** Los resultados se guardan en `vision_cache.json` para no reprocesar
5. **Indexacion:** El texto extraido se agrega como chunks adicionales al CV

### Configuracion

Vision OCR esta **habilitado por defecto**. Para deshabilitarlo, modificar en `cv_processor.py`:

```python
processor = CVProcessor(CV_FOLDER, use_vision=False)
```

### Requisitos

- **GOOGLE_API_KEY** configurada en `.env`
- Conexion a internet (para llamar a Gemini API)
- CVs con imagenes relevantes (no todos los CVs tienen)

### Costos

El uso de Gemini Flash Vision es muy economico:
- ~$0.00001 por imagen pequena
- Para 48 CVs con ~2-3 imagenes cada uno: ~$0.01-0.02 total

### Cache de Imagenes

El archivo `vision_cache.json` almacena los textos ya extraidos:

```json
{
  "hash_md5_de_imagen": "Texto extraido de la imagen...",
  "otro_hash": "Otro texto..."
}
```

**Beneficios del cache:**
- Reindexaciones subsecuentes son instantaneas
- No se reprocesa la misma imagen dos veces
- Reduce costos de API

**Para forzar reprocesamiento:**
```bash
rm vision_cache.json
curl -X POST "http://localhost:8080/reindex-cvs"
```

### Probar Vision OCR manualmente

```bash
cd mcp
python cv_vision.py "cvs/NOMBRE_CANDIDATO.pdf"
```

Salida ejemplo:
```
Procesando: CESAR AUGUSTO MENDEZ MARTINEZ.pdf
==================================================

Se encontraron 14 imagenes con texto:

--- Pagina 1, Imagen 0 ---
Cesar Augusto Mendez
Consultor PI/PO/CPI/ABAP/ABAP-HCM
Tarjeta profesional: 25251234
...
```

### Identificar chunks de imagenes

Los chunks extraidos de imagenes tienen el prefijo `[IMAGEN]`:

```json
{
  "text": "[IMAGEN] AWS Certified Solutions Architect Associate SAA-C03 Issued: 2024..."
}
```

---

## Modelos de IA Utilizados

| Componente | Modelo | Proveedor | Uso |
|------------|--------|-----------|-----|
| **Embeddings** | `paraphrase-multilingual-MiniLM-L12-v2` | Sentence Transformers | Vectorizacion de texto para busqueda semantica |
| **Vision OCR** | `gemini-2.0-flash-exp` | Google | Extraccion de texto de imagenes en CVs |
| **Chat** | `gemini-3-pro-preview` | Google | Consultas en lenguaje natural (endpoint /chat) |

---

## Contacto y Soporte

Para problemas tecnicos con el matching o indexacion de CVs, revisar los logs del servidor o contactar al equipo de desarrollo.
