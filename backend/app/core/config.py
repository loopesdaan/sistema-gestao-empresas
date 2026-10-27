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
    
    # Cloudflare R2 Storage (Bucket: sistema-gestao-prd)
    CLOUDFLARE_R2_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID", "3126bc469b40c4d4fd9b5a0c24930aa6")
    CLOUDFLARE_R2_BUCKET_NAME: str = os.getenv("CLOUDFLARE_R2_BUCKET_NAME", "sistema-gestao-prd")
    CLOUDFLARE_R2_ENDPOINT_URL: str = os.getenv(
        "CLOUDFLARE_R2_ENDPOINT_URL", 
        "https://3126bc469b40c4d4fd9b5a0c24930aa6.r2.cloudflarestorage.com"
    )
    CLOUDFLARE_R2_ACCESS_KEY_ID: str = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: str = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
    CLOUDFLARE_R2_PUBLIC_URL: str = os.getenv("CLOUDFLARE_R2_PUBLIC_URL", "")
    
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
