"""
Cliente para Google Cloud Storage.
"""
import logging
import uuid
from pathlib import Path

from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError

from core.config import settings

logger = logging.getLogger(__name__)


class StorageClient:
    """Cliente para interactuar con Google Cloud Storage."""
    
    def __init__(self, client=None):
        """Inicializa el cliente de Cloud Storage."""
        if client:
             self.client = client
        else:
             self.client = storage.Client(project=settings.GCP_PROJECT_ID)
             
        self.bucket_name = settings.GCS_BUCKET
        self.bucket = self.client.bucket(self.bucket_name)
        logger.info(f"Storage client initialized for bucket: {self.bucket_name}")
    
    def upload_file(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str = "application/pdf",
        folder: str = "uploads",
    ) -> str:
        """
        Sube un archivo a Cloud Storage.
        
        Args:
            file_content: Contenido del archivo en bytes
            file_name: Nombre original del archivo
            content_type: Tipo MIME del archivo
            folder: Carpeta destino en el bucket
            
        Returns:
            URI del archivo en GCS (gs://bucket/path/file)
        """
        try:
            # Generar path único
            file_id = str(uuid.uuid4())
            path = Path(file_name)
            stem = path.stem
            suffix = path.suffix
            
            # Formato solicitado: nombre-uuid.ext
            blob_name = f"{folder}/{stem}-{file_id}{suffix}"
            
            # Subir archivo
            blob = self.bucket.blob(blob_name)
            blob.upload_from_string(
                file_content,
                content_type=content_type,
            )
            
            gcs_uri = f"gs://{self.bucket_name}/{blob_name}"
            logger.info(f"File uploaded successfully: {gcs_uri}")
            return gcs_uri
            
        except GoogleCloudError as e:
            logger.error(f"Failed to upload file to GCS: {e}")
            raise
    
    def download_file(self, gcs_uri: str) -> bytes:
        """
        Descarga un archivo desde Cloud Storage.
        
        Args:
            gcs_uri: URI del archivo (gs://bucket/path/file)
            
        Returns:
            Contenido del archivo en bytes
        """
        try:
            # Extraer blob name del URI
            blob_name = gcs_uri.replace(f"gs://{self.bucket_name}/", "")
            blob = self.bucket.blob(blob_name)
            
            content = blob.download_as_bytes()
            logger.info(f"File downloaded: {gcs_uri}")
            return content
            
        except GoogleCloudError as e:
            logger.error(f"Failed to download file from GCS: {e}")
            raise
    
    def delete_file(self, gcs_uri: str) -> bool:
        """
        Elimina un archivo de Cloud Storage.
        
        Args:
            gcs_uri: URI del archivo (gs://bucket/path/file)
            
        Returns:
            True si se eliminó correctamente
        """
        try:
            blob_name = gcs_uri.replace(f"gs://{self.bucket_name}/", "")
            blob = self.bucket.blob(blob_name)
            blob.delete()
            
            logger.info(f"File deleted: {gcs_uri}")
            return True
            
        except GoogleCloudError as e:
            logger.error(f"Failed to delete file from GCS: {e}")
            raise
    
    def get_signed_url(self, gcs_uri: str, expiration_minutes: int = 60) -> str:
        """
        Genera una URL firmada para acceso temporal al archivo.
        
        Args:
            gcs_uri: URI del archivo
            expiration_minutes: Minutos de validez de la URL
            
        Returns:
            URL firmada
        """
        from datetime import timedelta
        
        try:
            blob_name = gcs_uri.replace(f"gs://{self.bucket_name}/", "")
            blob = self.bucket.blob(blob_name)
            
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET",
            )
            
            return url
            
        except GoogleCloudError as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise


# Singleton instance
_storage_client: StorageClient | None = None


def get_storage_client() -> StorageClient:
    """Get or create Storage client singleton."""
    global _storage_client
    if _storage_client is None:
        _storage_client = StorageClient()
    return _storage_client
