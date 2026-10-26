import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Gestão Empresarial"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Segurança JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_gestao_jwt_key_development_change_in_production_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas
    
    # Banco de Dados (PostgreSQL padrão, com fallback para SQLite se configurado em dev)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg2://gestao_user:gestao_password@localhost:5432/gestao_db"
    )

    # URL pública do Frontend (Netlify em produção)
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL", "")
    
    # Mercado Pago
    MERCADO_PAGO_ACCESS_TOKEN: str = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")
    MERCADO_PAGO_WEBHOOK_SECRET: str = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET", "")
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
