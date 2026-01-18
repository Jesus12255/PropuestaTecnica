# Error 403 Forbidden al Subir Archivos Grandes en Produccion

## Problema

Al subir archivos grandes (ej: 7MB, 120 paginas) en produccion, se recibe un error **403 Forbidden**.

---

## Causa Principal: Google Cloud Run Request Limits

El despliegue en **Cloud Run** tiene limitaciones que causan el error 403:

### 1. **Timeout de Request (Causa mas probable)**

Cloud Run tiene un **timeout predeterminado de 300 segundos**, pero el **proxy/ingress de Cloud Run** puede cerrar la conexion antes si:
- La subida del archivo toma demasiado tiempo
- El tiempo de procesamiento (parsing PDF de 120 paginas) excede el limite

En el `cloudbuild.yaml` actual **NO** se configura `--timeout`, lo que deja el valor por defecto que puede ser insuficiente para archivos grandes.

### 2. **Request Body Size Limit**

Aunque Cloud Run permite hasta **32MB por request**, el problema puede estar en:
- **Google Cloud Load Balancer** frente a Cloud Run
- **Timeout del cliente** durante la transferencia

### 3. **Cloud Armor/WAF (Si esta habilitado)**

Si el proyecto tiene **Google Cloud Armor** configurado, puede estar bloqueando requests con:
- Body size > cierto limite
- Tiempo de conexion prolongado
- Contenido que parece "sospechoso" (PDFs grandes)

---

## Configuracion Actual

### cloudbuild.yaml (Deploy Backend)
```yaml
- 'run'
- 'deploy'
- '${_BACKEND_SERVICE_NAME}'
- '--region=${_GCP_REGION}'
- '--platform=managed'
- '--allow-unauthenticated'
# NO TIENE: --timeout, --memory, --cpu
```

### nginx.conf
```nginx
client_max_body_size 50M;  # Correcto para 7MB
```

### Backend config.py
```python
MAX_FILE_SIZE = 52428800  # 50MB - Correcto
```

---

## Solucion Recomendada

### 1. Agregar configuracion de timeout y recursos en Cloud Run

Modificar el paso "Deploy Backend" en `cloudbuild.yaml`:

```yaml
- 'run'
- 'deploy'
- '${_BACKEND_SERVICE_NAME}'
- '--image=${_GCP_REGION}-docker.pkg.dev/$PROJECT_ID/${_ARTIFACT_REGISTRY_REPO}/${_BACKEND_SERVICE_NAME}:$COMMIT_SHA'
- '--region=${_GCP_REGION}'
- '--platform=managed'
- '--allow-unauthenticated'
- '--timeout=600'           # 10 minutos para archivos grandes
- '--memory=2Gi'            # Mas memoria para procesar PDFs
- '--cpu=2'                 # Mas CPU para parsing
- '--max-instances=10'      # Limitar instancias
- '--add-cloudsql-instances=${_CLOUD_SQL_CONNECTION_NAME}'
- '--update-secrets=...'
```

### 2. Verificar Cloud Armor (si aplica)

```bash
gcloud compute security-policies list
gcloud compute security-policies describe [POLICY_NAME]
```

Si hay una politica, agregar excepcion para el endpoint de upload:
```bash
gcloud compute security-policies rules create 1000 \
  --security-policy=[POLICY_NAME] \
  --expression="request.path.matches('/api/v1/workspaces/.*/upload')" \
  --action=allow
```

### 3. Verificar logs de Cloud Run

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rfp-backend AND severity>=WARNING" --limit=50
```

### 4. Implementar upload chunked (solucion a largo plazo)

Para archivos muy grandes, implementar subida en chunks:
- Frontend divide el archivo en partes de 1-2MB
- Backend reconstruye el archivo
- Evita timeouts de conexion

---

## Resumen

| Causa | Probabilidad | Solucion |
|-------|--------------|----------|
| Timeout de Cloud Run | **Alta** | Agregar `--timeout=600` |
| Memoria insuficiente | Media | Agregar `--memory=2Gi` |
| Cloud Armor/WAF | Media | Verificar y excluir endpoint |
| Request body timeout | Media | Implementar chunked upload |

---

## Comando para Verificar Estado Actual

```bash
gcloud run services describe rfp-backend --region=us-central1 --format="yaml(spec.template.spec.containers[0].resources, spec.template.spec.timeoutSeconds)"
```
