import axios from 'axios';

// Definir la URL base de la API
const API_URL = 'http://localhost:8000/api/v1/storage';

// Interfaces alineadas con el backend (schemas)
export interface Carpeta {
  carpeta_id: string;
  nombre: string;
  url: string | null;
  creado: string;
  habilitado: boolean;
  parent_id: string | null;
  client_name?: string;
  version_count?: number;
}

export interface Archivo {
  archivo_id: string;
  carpeta_id: string;
  nombre: string;
  url: string;
  creado: string;
  habilitado: boolean;
}

export interface FolderContent {
  carpeta: Carpeta;
  subcarpetas: Carpeta[];
  archivos: Archivo[];
  path: Carpeta[];
}

export const storageService = {
  /**
   * Obtiene la lista de carpetas.
   * Si no se da parentId, trae las carpetas raíz.
   */
  getFolders: async (parentId?: string): Promise<Carpeta[]> => {
    try {
      const params = parentId ? { parent_id: parentId } : {};
      const response = await axios.get(`${API_URL}/folders`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}` // Asumiendo manejo de token estándar
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching folders:', error);
      throw error;
    }
  },

  /**
   * Obtiene el contenido completo de una carpeta (info, hijos, archivos).
   */
  getFolderContent: async (folderId: string, filters: Record<string, any> = {}): Promise<FolderContent> => {
    try {
      const response = await axios.get(`${API_URL}/folders/${folderId}`, {
        params: filters,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching content for folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Descarga un archivo.
   * Retorna una URL para que el navegador inicie la descarga.
   */
  getDownloadUrl: (fileId: string): string => {
    // Retornamos la URL directa al endpoint de descarga. 
    // El navegador (o window.open) manejará esto junto con el token si es necesario, 
    // pero para descargas de archivos a veces es más fácil usar un link directo si la auth es por cookie 
    // o manejarlo via blob si es bearer.
    // Dado que usamos Bearer, lo mejor es hacer la petición Axios blob.
    return `${API_URL}/files/${fileId}/download`;
  },

  /**
   * Descarga el archivo manejando la autenticación Bearer token
   */
  downloadFile: async (fileId: string, fileName: string) => {
    try {
      const response = await axios.get(`${API_URL}/files/${fileId}/download`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      // Crear link temporal
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      // Limpiar
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  },

  /**
   * Obtiene la URL para visualizar el archivo (Signed URL o Blob URL).
   * Retorna { url, type }
   */
  getFileViewUrl: async (fileId: string): Promise<{ url: string, type: string }> => {
    try {
      // SIEMPRE usar fallback local/proxy (Blob) para evitar problemas de CORS con GCS
      // cuando se renderiza dentro de un componente (react-doc-viewer).
      // Use /preview endpoint which handles DOCX -> PDF conversion
      const blobResponse = await axios.get(`${API_URL}/files/${fileId}/preview?t=${new Date().getTime()}`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      let fileType = blobResponse.headers['content-type'];

      // If the original request was for a file but we got PDF back, ensure frontend knows it's PDF
      // Note: Backend preview endpoint returns application/pdf for converted DOCX
      if (fileType === 'application/pdf') {
        console.log("Received PDF preview for file");
      }

      const blob = new Blob([blobResponse.data], { type: fileType });
      const blobUrl = window.URL.createObjectURL(blob);

      return { url: blobUrl, type: fileType || 'application/octet-stream' };

    } catch (error) {
      console.error('Get view URL failed:', error);
      throw error;
    }
  },

  /**
   * Intenta abrir el archivo en una nueva pestaña (Legacy).
   */
  viewFile: async (fileId: string, _fileName: string) => {
    try {
      const { url } = await storageService.getFileViewUrl(fileId);
      window.open(url, '_blank');
    } catch (error) {
      console.error('View failed:', error);
      throw error;
    }
  }
};
