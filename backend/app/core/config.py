from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "amzur-ai-chat"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Supabase HTTP API
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # LiteLLM Proxy
    LITELLM_PROXY_URL: str
    LITELLM_API_KEY: str
    LLM_MODEL: str = "gemini-2.0-flash"
    LITELLM_EMBEDDING_MODEL: str = "text-embedding-3-large"
    IMAGE_GEN_MODEL: str = "gemini-2.0-flash"

    # Organisation email domain restriction (comma-separated)
    ALLOWED_EMAIL_DOMAINS: str = "amzur.com,stackyon.com"

    # Supabase PostgreSQL (for Alembic migrations)
    # Format: postgresql+psycopg2://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
    SUPABASE_DATABASE_URL: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # Google Sheets Service Account (optional until P9)
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    # File Uploads
    MAX_UPLOAD_MB: int = 20
    UPLOAD_DIR: str = "./uploads"


settings = Settings()
