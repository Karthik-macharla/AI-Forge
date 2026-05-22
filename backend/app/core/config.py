from pathlib import Path

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
    VIDEO_GEN_MODEL: str = "veo-2"

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
    CHROMA_PERSIST_DIR: str = "C:/SDG_1_backend/chroma_db"

    # Google Sheets Service Account (optional until P9)
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    # Sheets / CSV Query Agent (Project 9)
    SHEETS_MAX_ROWS: int = 1000  # cap rows sent to the pandas agent to avoid token overflow

    # Research Digest Agent (Project 10)
    RESEARCH_MAX_PAPERS: int = 15
    RESEARCH_CONFIDENCE_THRESHOLD: float = 0.75
    RESEARCH_MAX_ITERATIONS: int = 3

    # Tic Tac Toe AI Agent (Project 11)
    TICTACTOE_MAX_RETRIES: int = 3
    TICTACTOE_LLM_TEMPERATURE: float = 0.2

    # File Uploads
    MAX_UPLOAD_MB: int = 20
    UPLOAD_DIR: str = "C:/SDG_1_backend/storage"
    ACCEPTED_MIME_TYPES: str = (
        "image/jpeg,image/png,image/gif,image/webp,"
        "application/pdf,"
        "text/plain,text/x-python,text/javascript,"
        "video/mp4,video/webm,video/ogg,video/quicktime,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    # NL2SQL (Project 8)
    # Sync SQLAlchemy URL for the target query database.
    # Defaults to the demo SQLite DB when left empty.
    NL2SQL_DATABASE_URL: str = ""
    NL2SQL_MAX_ROWS: int = 100
    NL2SQL_SCHEMA_CACHE_TTL: int = 300  # seconds

    # MCP Integration (Project 12)
    MCP_ARXIV_SERVER_SCRIPT: str = str(
        Path(__file__).parent.parent.parent / "mcp_servers" / "arxiv_server.py"
    )

    # N8N Integration (Project 13)
    N8N_API_KEY: str = ""
    N8N_WEBHOOK_URL: str = ""
    N8N_STATUS_WEBHOOK_URL: str = ""


settings = Settings()
