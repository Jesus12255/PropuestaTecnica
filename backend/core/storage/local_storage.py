"""
Servicio de almacenamiento local para documentos RFP.
Alternativa a Cloud Storage para desarrollo y entornos sin GCP.
"""
import logging
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

from core.config import settings

logger = logging.getLogger(__name__)


class LocalStorageService:
    """Servicio para almacenar archivos localmente."""
    
    def __init__(self, base_path: str | None = None):
        """
        Inicializa el servicio de almacenamiento local.
        
        Args:
            base_path: Ruta base para almacenar archivos. 
                       Por defecto usa /app/uploads o ./uploads
        """
        if base_path:
            self.base_path = Path(base_path)
        else:
            # Usar variable de entorno o default (temp dir para Vercel)
            import tempfile
            default_dir = os.path.join(tempfile.gettempdir(), "propuesta_tecnica_uploads")
            upload_dir = os.getenv("LOCAL_STORAGE_PATH", default_dir)
            self.base_path = Path(upload_dir)
        
        # Crear directorio si no existe
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Local storage initialized at: {self.base_path}")
    
    def _generate_file_path(self, original_filename: str, folder: str = "documents") -> tuple[str, Path]:
        """
        Genera un path único para el archivo.
        
        Returns:
            Tuple de (file_id, full_path)
        """
        file_id = str(uuid.uuid4())
        extension = Path(original_filename).suffix.lower()
        safe_filename = f"{file_id}{extension}"
        
        # Organizar por fecha para evitar directorios muy grandes
        date_folder = datetime.now().strftime("%Y/%m/%d")
        target_dir = self.base_path / folder / date_folder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        full_path = target_dir / safe_filename
        
        return file_id, full_path
    
    def upload_file(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str = "application/pdf",
        folder: str = "documents",
    ) -> str:
        """
        Guarda un archivo localmente.
        
        Args:
            file_content: Contenido del archivo en bytes
            file_name: Nombre original del archivo
            content_type: Tipo MIME del archivo
            folder: Carpeta destino
            
        Returns:
            URI local del archivo (local://path/to/file)
        """
        try:
            file_id, full_path = self._generate_file_path(file_name, folder)
            
            # Escribir archivo
            with open(full_path, "wb") as f:
                f.write(file_content)
            
            # Guardar metadata
            self._save_metadata(full_path, {
                "original_name": file_name,
                "content_type": content_type,
                "size_bytes": len(file_content),
                "uploaded_at": datetime.now().isoformat(),
            })
            
            # Retornar URI relativo
            relative_path = full_path.relative_to(self.base_path)
            local_uri = f"local://{relative_path}"
            
            logger.info(f"File saved locally: {local_uri} ({len(file_content)} bytes)")
            return local_uri
            
        except Exception as e:
            logger.error(f"Failed to save file locally: {e}")
            raise
    
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
            URI local del archivo
        """
        content = file_obj.read()
        return self.upload_file(content, file_name, content_type, folder)
    
    def download_file(self, local_uri: str) -> bytes:
        """
        Lee un archivo del almacenamiento local.
        
        Args:
            local_uri: URI del archivo (local://path/to/file)
            
        Returns:
            Contenido del archivo en bytes
        """
        try:
            relative_path = local_uri.replace("local://", "")
            full_path = self.base_path / relative_path
            
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {local_uri}")
            
            with open(full_path, "rb") as f:
                content = f.read()
            
            logger.info(f"File downloaded: {local_uri}")
            return content
            
        except Exception as e:
            logger.error(f"Failed to download file: {e}")
            raise
    
    def get_file_path(self, local_uri: str) -> Path:
        """
        Obtiene el path absoluto de un archivo.
        
        Args:
            local_uri: URI del archivo (local://path/to/file)
            
        Returns:
            Path absoluto del archivo
        """
        relative_path = local_uri.replace("local://", "")
        return self.base_path / relative_path
    
    def delete_file(self, local_uri: str) -> bool:
        """
        Elimina un archivo del almacenamiento local.
        
        Args:
            local_uri: URI del archivo (local://path/to/file)
            
        Returns:
            True si se eliminó correctamente
        """
        try:
            relative_path = local_uri.replace("local://", "")
            full_path = self.base_path / relative_path
            
            if full_path.exists():
                full_path.unlink()
                
                # También eliminar metadata si existe
                metadata_path = full_path.with_suffix(full_path.suffix + ".meta")
                if metadata_path.exists():
                    metadata_path.unlink()
                
                logger.info(f"File deleted: {local_uri}")
                return True
            else:
                logger.warning(f"File not found for deletion: {local_uri}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete file: {e}")
            raise
    
    def file_exists(self, local_uri: str) -> bool:
        """
        Verifica si un archivo existe.
        
        Args:
            local_uri: URI del archivo (local://path/to/file)
            
        Returns:
            True si el archivo existe
        """
        relative_path = local_uri.replace("local://", "")
        full_path = self.base_path / relative_path
        return full_path.exists()
    
    def get_file_size(self, local_uri: str) -> int:
        """
        Obtiene el tamaño de un archivo en bytes.
        
        Args:
            local_uri: URI del archivo
            
        Returns:
            Tamaño en bytes
        """
        relative_path = local_uri.replace("local://", "")
        full_path = self.base_path / relative_path
        return full_path.stat().st_size if full_path.exists() else 0
    
    def _save_metadata(self, file_path: Path, metadata: dict):
        """Guarda metadata del archivo en un archivo .meta."""
        import json
        metadata_path = file_path.with_suffix(file_path.suffix + ".meta")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    
    def get_metadata(self, local_uri: str) -> dict | None:
        """Lee metadata de un archivo."""
        import json
        relative_path = local_uri.replace("local://", "")
        full_path = self.base_path / relative_path
        metadata_path = full_path.with_suffix(full_path.suffix + ".meta")
        
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                return json.load(f)
        return None
    
    def list_files(self, folder: str = "documents") -> list[str]:
        """
        Lista todos los archivos en una carpeta.
        
        Args:
            folder: Carpeta a listar
            
        Returns:
            Lista de URIs de archivos
        """
        target_dir = self.base_path / folder
        if not target_dir.exists():
            return []
        
        files = []
        for path in target_dir.rglob("*"):
            if path.is_file() and not path.suffix == ".meta":
                relative_path = path.relative_to(self.base_path)
                files.append(f"local://{relative_path}")
        
        return files
    
    def get_storage_stats(self) -> dict:
        """
        Obtiene estadísticas del almacenamiento.
        
        Returns:
            Dict con estadísticas
        """
        total_size = 0
        file_count = 0
        
        for path in self.base_path.rglob("*"):
            if path.is_file() and not path.suffix == ".meta":
                total_size += path.stat().st_size
                file_count += 1
        
        return {
            "base_path": str(self.base_path),
            "total_files": file_count,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }


# Singleton instance
_storage_service: LocalStorageService | None = None


def get_storage_service() -> LocalStorageService:
    """Get or create LocalStorage service singleton."""
    global _storage_service
    if _storage_service is None:
        _storage_service = LocalStorageService()
    return _storage_service
