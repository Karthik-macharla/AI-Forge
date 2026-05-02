from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "amzur-ai-chat"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # LiteLLM Proxy
    LITELLM_PROXY_URL: str
    LITELLM_API_KEY: str
    LLM_MODEL: str = "gemini-2.0-flash"
    LITELLM_EMBEDDING_MODEL: str = "text-embedding-3-large"
    IMAGE_GEN_MODEL: str = "gemini-2.0-flash"

    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # Google Service Account
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""

    # File Uploads
    MAX_UPLOAD_MB: int = 20
    UPLOAD_DIR: str = "./uploads"


settings = Settings()
