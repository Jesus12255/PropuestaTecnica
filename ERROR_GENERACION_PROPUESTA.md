# Por Que Falla la Generacion de Propuestas

## Causas Identificadas

### 1. **Timeout del LLM (Causa Principal)**

En `document_generation.py:91-94`, la generacion usa `llm_service.generate_response()` sin timeout configurado:

```python
content = llm_service.generate_response(
    query=synthesis_prompt,
    context_chunks=[]
)
```

Cuando el prompt es muy largo (conversaciones extensas + documentos grandes), **Gemini o GPT-4 pueden tardar mas de 60 segundos**, y Cloud Run cierra la conexion.

---

### 2. **Contenido Generado Demasiado Corto**

En `document_generation.py:210-214`:

```python
if len(content.strip()) < 100:
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="El contenido generado es demasiado corto. Intenta nuevamente."
    )
```

El LLM a veces genera respuestas truncadas o vacias cuando:
- El contexto excede el limite de tokens
- Hay rate limiting en la API de Gemini/OpenAI
- La respuesta queda cortada por timeout

---

### 3. **Variable `filename` No Definida (BUG)**

En `document_generation.py:228`:

```python
"Content-Disposition": f"attachment; filename={filename}"
```

**La variable `filename` NO esta definida** antes de usarse en el caso de PDF. Esto causa un `NameError` y el endpoint devuelve 500.

---

### 4. **Falta de Imagen de Portada en Produccion**

En `document_service.py:74-88`:

```python
image_path = os.path.join(backend_dir, 'src', 'assets', 'portada_tivit.jpg')

if os.path.exists(image_path):
    doc.add_picture(image_path, width=Inches(6))
else:
    logger.warning(f"No se encontro imagen de portada en: {image_path}")
```

En produccion (Cloud Run), si la imagen no esta incluida en el Docker build, la generacion **no falla pero el documento queda incompleto**.

---

### 5. **Rate Limiting de Gemini API**

El proyecto usa Gemini como proveedor principal. Google Gemini tiene limites:
- **60 requests por minuto** (tier gratuito)
- **4 millones de tokens por minuto** (tier pago)

Si multiples usuarios generan propuestas simultaneamente, el LLM devuelve error 429 y la generacion falla.

---

### 6. **Memoria Insuficiente en Cloud Run**

La generacion de PDF/DOCX con ReportLab/python-docx consume memoria RAM. Para documentos largos:
- Creacion de multiples objetos en memoria
- Imagenes de portada cargadas en memoria
- BytesIO buffers acumulados

Si Cloud Run tiene menos de 1GB RAM asignada, el proceso puede morir por OOM (Out of Memory).

---

### 7. **Excepciones Silenciadas**

En varios lugares el codigo captura excepciones generico sin re-lanzar:

```python
except Exception as e:
    logger.error(f"Error adjuntando imagen PDF: {e}")
    # Continua sin fallar pero el documento puede quedar corrupto
```

---

## Resumen de Causas

| Causa | Severidad | Solucion |
|-------|-----------|----------|
| Timeout LLM | **Alta** | Agregar timeout y retry |
| Variable `filename` undefined | **Alta** | Fix bug en codigo |
| Rate limiting Gemini | Media | Implementar cola/retry |
| Memoria Cloud Run | Media | Aumentar a 2Gi |
| Imagen portada no existe | Baja | Incluir en Dockerfile |
| Contenido muy corto | Baja | Validar antes de generar |

---

## Solucion Rapida: Fix del Bug `filename`

```python
# En document_generation.py, agregar ANTES del if request.format == "pdf":
safe_title = conversation.title.replace(' ', '_').replace('/', '-')[:50]
filename = f"{safe_title}_{request.document_type}.{request.format}"

if request.format == "pdf":
    # ...
```
