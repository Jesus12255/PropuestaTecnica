"""
Configuración centralizada del backend.
Usa Pydantic Settings para validación y carga desde env vars.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Configuración de la aplicación."""
    
    # App
    APP_NAME: str = "RFP Analyzer API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Database (Cloud SQL PostgreSQL)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/rfp_analyzer",
        description="PostgreSQL connection string"
    )
    
    # GCP Settings
    GCP_PROJECT_ID: str = Field(default="", description="Google Cloud Project ID")
    GCP_LOCATION: str = Field(default="us-central1", description="GCP Region")
    GCS_BUCKET: str = Field(default="", description="Cloud Storage bucket for RFP files")
    
    # GCP Credentials (Service Account JSON path - for Cloud Storage)
    GOOGLE_APPLICATION_CREDENTIALS: str = Field(
        default="/app/gcp-credentials.json",
        description="Path to GCP service account JSON file"
    )
    
    # Google AI API Key (for Gemini)
    GOOGLE_API_KEY: str = Field(
        default="",
        description="Google AI Studio API Key for Gemini"
    )
    
    # Gemini Settings
    GEMINI_MODEL: str = Field(
        default="gemini-3-pro-preview",
        description="Gemini model to use (gemini-3-pro-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash)"
    )
    
    # JWT Settings
    JWT_SECRET_KEY: str = Field(default="change-me-in-production", description="JWT secret key")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
