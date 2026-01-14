"""
Servicio de almacenamiento híbrido.
Usa GCP Cloud Storage como principal y almacenamiento local como fallback.
"""
import logging
from pathlib import Path
from typing import Protocol, runtime_checkable, BinaryIO

from core.config import settings

logger = logging.getLogger(__name__)


@runtime_checkable
class StorageBackend(Protocol):
    """Protocolo para backends de almacenamiento."""
    
    def upload_file(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str,
        folder: str,
    ) -> str: ...
    
    def download_file(self, uri: str) -> bytes: ...
    
    def delete_file(self, uri: str) -> bool: ...


class HybridStorageService:
    """
    Servicio de almacenamiento híbrido.
    Intenta usar GCP Cloud Storage primero, y si falla usa almacenamiento local.
    """
    
    def __init__(self):
        """Inicializa el servicio con GCS como primario y local como fallback."""
        self._gcs_client = None
        self._local_storage = None
        self._gcs_available = False
        
        # Intentar inicializar GCS
        self._init_gcs()
        
        # Siempre inicializar local storage como fallback
        self._init_local_storage()
        
        if self._gcs_available:
            logger.info("Hybrid storage initialized: GCS primary, local fallback")
        else:
            logger.info("Hybrid storage initialized: local only (GCS not available)")
    
    def _init_gcs(self):
        """Intenta inicializar el cliente de GCS."""
        try:
            # Verificar configuración mínima
            if not settings.GCP_PROJECT_ID or not settings.GCS_BUCKET:
                logger.warning("GCS not configured: missing GCP_PROJECT_ID or GCS_BUCKET")
                return

            from google.cloud import storage
            from google.oauth2 import service_account
            from google.auth.exceptions import DefaultCredentialsError

            client = None

            # Estrategia 1: Credenciales explícitas desde variables de entorno
            if settings.GCP_CLIENT_EMAIL and settings.GCP_PRIVATE_KEY:
                # Corregir formato de la llave privada (reemplazar \\n por \n reales)
                private_key = settings.GCP_PRIVATE_KEY.replace("\\n", "\n")
                
                creds_dict = {
                    "type": "service_account",
                    "project_id": settings.GCP_PROJECT_ID,
                    "private_key_id": "env_var_key", # id dummy
                    "private_key": private_key,
                    "client_email": settings.GCP_CLIENT_EMAIL,
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
                
                credentials = service_account.Credentials.from_service_account_info(creds_dict)
                client = storage.Client(credentials=credentials, project=settings.GCP_PROJECT_ID)
                logger.info("Initializing GCS with credentials from environment variables")

            # Estrategia 2: Archivo JSON (GOOGLE_APPLICATION_CREDENTIALS)
            elif settings.GOOGLE_APPLICATION_CREDENTIALS:
                creds_path = Path(settings.GOOGLE_APPLICATION_CREDENTIALS)
                if creds_path.exists():
                    import os
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds_path.resolve())
                    client = storage.Client(project=settings.GCP_PROJECT_ID)
                    logger.info(f"Initializing GCS with credentials file: {creds_path}")
                else:
                    logger.warning(f"GCS credentials file not found: {creds_path}")

            # Estrategia 3: Default (ADC)
            else:
                client = storage.Client(project=settings.GCP_PROJECT_ID)
                logger.info("Initializing GCS with Application Default Credentials")

            if client:
                bucket = client.bucket(settings.GCS_BUCKET)
                # No llamamos a bucket.reload() aquí porque requiere permisos de 'storage.buckets.get'
                # que una Service Account de solo escritura podría no tener.
                # Si falla el upload despues, el fallback a local lo manejará.
                
                from core.gcp.storage import StorageClient
                # Inyectar el cliente ya configurado
                self._gcs_client = StorageClient(client=client)
                self._gcs_available = True
                logger.info(f"GCS client initialized optimistically for bucket: {settings.GCS_BUCKET}")
            else:
                logger.warning("No credentials found for GCS")
                return
            
        except ImportError:
            logger.warning("google-cloud-storage not installed, GCS not available")
        except DefaultCredentialsError as e:
            logger.warning(f"GCS credentials error: {e}")
        except Exception as e:
            logger.warning(f"Failed to initialize GCS client: {e}")
            
    def upload_file_object(
        self,
        file_obj: BinaryIO,
        file_name: str,
        content_type: str = "application/pdf",
        folder: str = "documents",
    ) -> str:
        """
        Guarda un archivo desde un objeto file-like.
        
        Args:
            file_obj: Objeto file-like con el contenido
            file_name: Nombre original del archivo
            content_type: Tipo MIME del archivo
            folder: Carpeta destino
            
        Returns:
            URI del archivo
        """
        content = file_obj.read()
        return self.upload_file(content, file_name, content_type, folder)
    
    def _init_local_storage(self):
        """Inicializa el almacenamiento local."""
        from core.storage.local_storage import LocalStorageService
        self._local_storage = LocalStorageService()
    
    @property
    def is_gcs_available(self) -> bool:
        """Indica si GCS está disponible."""
        return self._gcs_available
    
    @property
    def primary_storage(self) -> str:
        """Indica cuál es el almacenamiento primario actual."""
        return "gcs" if self._gcs_available else "local"
    
    def upload_file(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str = "application/pdf",
        folder: str = "documents",
    ) -> str:
        """
        Sube un archivo EXCLUSIVAMENTE a GCS.
        
        Args:
            file_content: Contenido del archivo en bytes
            file_name: Nombre original del archivo
            content_type: Tipo MIME del archivo
            folder: Carpeta destino
            
        Returns:
            URI del archivo (gs:// para GCS)
            
        Raises:
            RuntimeError: Si GCS no está disponible.
        """
        if not self._gcs_available or not self._gcs_client:
             raise RuntimeError("GCS storage is not available and local storage is disabled.")

        try:
            uri = self._gcs_client.upload_file(
                file_content=file_content,
                file_name=file_name,
                content_type=content_type,
                folder=folder,
            )
            logger.info(f"File uploaded to GCS: {uri}")
            return uri
            
        except Exception as e:
            logger.error(f"GCS upload failed: {e}")
            raise RuntimeError(f"Failed to upload file to GCS: {e}")
    
    def download_file(self, uri: str) -> bytes:
        """
        Descarga un archivo desde su URI.
        
        Args:
            uri: URI del archivo (gs:// o local://)
            
        Returns:
            Contenido del archivo en bytes
        """
        if uri.startswith("gs://"):
            if not self._gcs_available or not self._gcs_client:
                raise RuntimeError("Cannot download from GCS: client not available")
            return self._gcs_client.download_file(uri)
        
        elif uri.startswith("local://"):
            return self._local_storage.download_file(uri)
        
        else:
            raise ValueError(f"Unknown URI scheme: {uri}")
    
    def delete_file(self, uri: str) -> bool:
        """
        Elimina un archivo.
        
        Args:
            uri: URI del archivo (gs:// o local://)
            
        Returns:
            True si se eliminó correctamente
        """
        if uri.startswith("gs://"):
            if not self._gcs_available or not self._gcs_client:
                logger.warning("Cannot delete from GCS: client not available")
                return False
            return self._gcs_client.delete_file(uri)
        
        elif uri.startswith("local://"):
            return self._local_storage.delete_file(uri)
        
        else:
            raise ValueError(f"Unknown URI scheme: {uri}")
    
    def get_file_path(self, uri: str) -> Path | None:
        """
        Obtiene el path local de un archivo (solo para archivos locales).
        
        Args:
            uri: URI del archivo
            
        Returns:
            Path absoluto si es local, None si es GCS
        """
        if uri.startswith("local://"):
            return self._local_storage.get_file_path(uri)
        return None
    
    def get_signed_url(self, uri: str, expiration_minutes: int = 60) -> str | None:
        """
        Genera una URL firmada para acceso temporal (solo GCS).
        
        Args:
            uri: URI del archivo
            expiration_minutes: Minutos de validez
            
        Returns:
            URL firmada o None si es local
        """
        if uri.startswith("gs://") and self._gcs_available and self._gcs_client:
            return self._gcs_client.get_signed_url(uri, expiration_minutes)
        return None
    
    def file_exists(self, uri: str) -> bool:
        """
        Verifica si un archivo existe.
        
        Args:
            uri: URI del archivo
            
        Returns:
            True si existe
        """
        if uri.startswith("local://"):
            return self._local_storage.file_exists(uri)
        
        elif uri.startswith("gs://"):
            if not self._gcs_available or not self._gcs_client:
                return False
            try:
                self._gcs_client.download_file(uri)
                return True
            except Exception:
                return False
        
        return False
    
    def get_storage_info(self) -> dict:
        """
        Obtiene información del estado del almacenamiento.
        
        Returns:
            Dict con información del storage
        """
        info = {
            "primary_storage": self.primary_storage,
            "gcs_available": self._gcs_available,
            "gcs_bucket": settings.GCS_BUCKET if self._gcs_available else None,
            "local_storage": self._local_storage.get_storage_stats() if self._local_storage else None,
        }
        return info


# Singleton instance
_hybrid_storage: HybridStorageService | None = None


def get_storage_service() -> HybridStorageService:
    """Get or create HybridStorage service singleton."""
    global _hybrid_storage
    if _hybrid_storage is None:
        _hybrid_storage = HybridStorageService()
    return _hybrid_storage
