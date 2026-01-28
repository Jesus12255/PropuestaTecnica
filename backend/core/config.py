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
    
    # Environment (development or production)
    ENV: str = Field(
        default="development",
        description="Environment: development or production"
    )
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Database URLs - Production (MUST be set in .env)
    DATABASE_URL_PRODUCTION: str = Field(
        default="",
        description="PostgreSQL connection string for PRODUCTION - REQUIRED in .env"
    )
    
    # Database URLs - Development (MUST be set in .env)
    DATABASE_URL_DEVELOPMENT: str = Field(
        default="",
        description="PostgreSQL connection string for DEVELOPMENT - REQUIRED in .env"
    )
    
    @property
    def DATABASE_URL(self) -> str:
        """
        Returns the appropriate database URL based on the ENV setting.
        - ENV=production -> DATABASE_URL_PRODUCTION
        - ENV=development -> DATABASE_URL_DEVELOPMENT
        """
        if self.ENV.lower() == "production":
            return self.DATABASE_URL_PRODUCTION
        else:
            return self.DATABASE_URL_DEVELOPMENT
    
    # GCP Settings
    GCP_PROJECT_ID: str = Field(default="squad-ia-latam", description="Google Cloud Project ID")
    GCP_LOCATION: str = Field(default="us-central1", description="GCP Region")
    GCS_BUCKET: str = Field(default="caso01-documents", description="Cloud Storage bucket for RFP files")
    
    # Storage Configuration
    USE_GCS: bool = Field(
        default=False,
        description="Enable Google Cloud Storage (True) or use only local storage (False)"
    )
    
    # GCP Credentials (Service Account JSON path - for Cloud Storage)
    GOOGLE_APPLICATION_CREDENTIALS: str | None = Field(
        default=None, 
        description="Path to GCP service account JSON file (optional if using env vars)"
    )
    
    # GCP Credentials (Environment Variables)
    GCP_CLIENT_EMAIL: str = Field(default="", description="GCP Service Account Email")
    GCP_PRIVATE_KEY: str = Field(default="", description="GCP Private Key")
    
    # Google AI API Key (for Gemini)
    GOOGLE_API_KEY: str = Field(
        default="",
        description="Google AI Studio API Key for Gemini"
    )
    
    # Gemini Settings
    GEMINI_MODEL: str = Field(
        default="gemini-3-pro-preview",
        description="Gemini model to use (gemini-3-pro-preview es el más potente para análisis complejos)"
    )
    
    # MCP Talent Search Server - Development (Docker)
    MCP_TALENT_URL_DEVELOPMENT: str = Field(
        default="http://mcp:8080",
        description="MCP URL for development (Docker container)"
    )
    
    # MCP Talent Search Server - Production
    MCP_TALENT_URL_PRODUCTION: str = Field(
        default="",
        description="MCP URL for production"
    )
    
    @property
    def MCP_TALENT_URL(self) -> str:
        """Returns MCP URL based on ENV setting."""
        if self.ENV.lower() == "production":
            return self.MCP_TALENT_URL_PRODUCTION
        return self.MCP_TALENT_URL_DEVELOPMENT
    
    # JWT Settings
    JWT_SECRET_KEY: str = Field(default="change-me-in-production", description="JWT secret key")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS (Separated by comma)
    CORS_ORIGINS: str = "*" 

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        
        origins = self.CORS_ORIGINS.split(",")
        cleaned_origins = []
        
        for origin in origins:
            # Clean up JSON-like artifacts and quotes
            clean = origin.strip().replace('[', '').replace(']', '').replace('"', '').replace("'", "")
            # Remove trailing slash
            if clean.endswith('/'):
                clean = clean[:-1]
            if clean:
                cleaned_origins.append(clean)
                
        return cleaned_origins
    
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
