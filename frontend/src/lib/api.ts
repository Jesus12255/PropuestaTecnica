/**
 * Cliente API para RFP Analyzer
 */
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  AuthToken,
  LoginCredentials,
  RegisterData,
  User,
  DashboardStats,
  RFPListResponse,
  RFPDetail,
  RFPQuestion,
  RFPDecision,
  RFPUpdate,
  UploadResponse,
  TeamSuggestionResponse,
  TeamEstimation,
  CostEstimation,
  SuggestedTeam,
  Certification,
  CertificationUploadResponse,
  Experience,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Crear instancia de axios
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor para añadir token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de auth
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthToken> => {
    const { data } = await api.post<AuthToken>('/auth/login', credentials);
    return data;
  },

  register: async (userData: RegisterData): Promise<AuthToken> => {
    const { data } = await api.post<AuthToken>('/auth/register', userData);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  refresh: async (): Promise<AuthToken> => {
    const { data } = await api.post<AuthToken>('/auth/refresh');
    return data;
  },

  getPreferences: async (): Promise<{ analysis_mode: 'fast' | 'balanced' | 'deep' }> => {
    const { data } = await api.get<{ analysis_mode: 'fast' | 'balanced' | 'deep' }>('/auth/preferences');
    return data;
  },

  updatePreferences: async (prefs: { analysis_mode: 'fast' | 'balanced' | 'deep' }): Promise<{ analysis_mode: 'fast' | 'balanced' | 'deep' }> => {
    const { data } = await api.put<{ analysis_mode: 'fast' | 'balanced' | 'deep' }>('/auth/preferences', prefs);
    return data;
  },
};

// ============ DASHBOARD ============

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/dashboard/stats');
    return data;
  },

  getRecent: async (limit: number = 10): Promise<RFPDetail[]> => {
    const { data } = await api.get<RFPDetail[]>(`/dashboard/recent?limit=${limit}`);
    return data;
  },

  getPending: async (): Promise<RFPDetail[]> => {
    const { data } = await api.get<RFPDetail[]>('/dashboard/pending');
    return data;
  },

  getByCategory: async (): Promise<Array<{ category: string; count: number }>> => {
    const { data } = await api.get('/dashboard/by-category');
    return data;
  },

  getByStatus: async (): Promise<Array<{ status: string; count: number }>> => {
    const { data } = await api.get('/dashboard/by-status');
    return data;
  },
};

// ============ RFP ============

export const rfpApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<RFPListResponse> => {
    const { data } = await api.get<RFPListResponse>('/rfp', { params });
    return data;
  },

  get: async (id: string): Promise<RFPDetail> => {
    const { data } = await api.get<RFPDetail>(`/rfp/${id}`);
    return data;
  },

  update: async (id: string, updateData: RFPUpdate): Promise<RFPDetail> => {
    const { data } = await api.patch<RFPDetail>(`/rfp/${id}`, updateData);
    return data;
  },

  upload: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post<UploadResponse>('/rfp/upload', formData);
    return data;
  },

  makeDecision: async (id: string, decision: RFPDecision): Promise<RFPDetail> => {
    const { data } = await api.post<RFPDetail>(`/rfp/${id}/decision`, decision);
    return data;
  },

  getQuestions: async (id: string): Promise<RFPQuestion[]> => {
    const { data } = await api.get<RFPQuestion[]>(`/rfp/${id}/questions`);
    return data;
  },

  regenerateQuestions: async (id: string): Promise<RFPQuestion[]> => {
    const { data } = await api.post<RFPQuestion[]>(`/rfp/${id}/questions/regenerate`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rfp/${id}`);
  },

  /**
   * Busca candidatos del equipo usando MCP Talent Search
   * @param id - ID del RFP
   * @param forceRefresh - Si es true, vuelve a consultar MCP aunque ya existan resultados
   */
  suggestTeam: async (id: string, forceRefresh?: boolean): Promise<TeamSuggestionResponse> => {
    const params = forceRefresh ? { force_refresh: true } : {};
    const { data } = await api.post<TeamSuggestionResponse>(`/rfp/${id}/suggest-team`, null, { params });
    return data;
  },

  /**
   * Obtiene la estimación de equipo y costos guardada para un RFP
   */
  getTeamEstimation: async (id: string): Promise<{
    team_estimation: TeamEstimation | null;
    cost_estimation: CostEstimation | null;
    suggested_team: SuggestedTeam | null;
  }> => {
    const { data } = await api.get<{
      team_estimation: TeamEstimation | null;
      cost_estimation: CostEstimation | null;
      suggested_team: SuggestedTeam | null;
    }>(`/rfp/${id}/team-estimation`);
    return data;
  },
};

// ============ CERTIFICATIONS ============

export const certificationsApi = {
  list: async (): Promise<Certification[]> => {
    const { data } = await api.get<Certification[]>('/certifications/');
    return data;
  },

  upload: async (file: File): Promise<CertificationUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Note: The backend endpoint is /certifications/save
    const { data } = await api.post<CertificationUploadResponse>('/certifications/save', formData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/certifications/${id}`);
  },

  download: async (id: string): Promise<Blob> => {
    const response = await api.get(`/certifications/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ============ PROPOSAL GENERATION ============

export const proposalApi = {
  generate: async (rfpId: string, selectedCertIds: string[] = [], selectedExpIds: string[] = [], selectedChapIds: string[] = []) => {
    const response = await api.post('/proposal/generate', { // CORRECTED URL to match backend router prefix
      rfp_id: rfpId, // Ensure match with backend schema
      certification_ids: selectedCertIds,
      experience_ids: selectedExpIds,
      chapter_ids: selectedChapIds
    }, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const experiencesApi = {
  list: async () => {
    const response = await api.get<Experience[]>('/experiences/');
    return response.data;
  },
  create: async (data: Omit<Experience, 'id' | 'created_at'>) => {
    const response = await api.post<Experience>('/experiences/', data);
    return response.data;
  },
  update: async (id: string, data: Partial<Experience>) => {
    const response = await api.put<Experience>(`/experiences/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/experiences/${id}`);
  },
  getRecommendations: async (rfpId: string) => {
    const response = await api.post<{ experience_id: string; score: number; reason: string }[]>('/experiences/recommendations', { rfp_id: rfpId });
    return response.data;
  },
};


export interface Chapter {
  id: string;
  name: string;
  description: string;
  filename: string;
  location: string;
  created_at: string;
}

export const chaptersApi = {
  list: async (): Promise<Chapter[]> => {
    const { data } = await api.get<Chapter[]>('/chapters/');
    return data;
  },

  upload: async (file: File): Promise<{ message: string; id: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<{ message: string; id: string }>('/chapters/save', formData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/chapters/${id}`);
  },

  download: async (id: string): Promise<Blob> => {
    const response = await api.get(`/chapters/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getRecommendations: async (rfpId: string) => {
    const { data } = await api.post<{ chapter_id: string; score: number; reason: string }[]>('/chapters/recommendations', { rfp_id: rfpId });
    return data;
  },
};

export default api;
