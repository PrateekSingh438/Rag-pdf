"""Application settings, loaded from environment / .env file.

All tunables (DB URL, JWT secret, model ids, storage dirs, Groq key) live here so
nothing is hardcoded elsewhere. Secrets come from .env (git-ignored), never code.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/studymate"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"  # higher free-tier limits; 70b for more quality
    embed_model: str = "BAAI/bge-small-en-v1.5"
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    # Reranked hits scoring below this are dropped (ms-marco cross-encoders give
    # clearly-irrelevant pairs ~-10; on-topic pairs sit well above). An empty
    # result then means "answer honestly: not found" without burning an LLM call.
    rerank_score_floor: float = -8.0
    # Agentic self-check: verify each answer's claims against its sources after
    # streaming (one extra fast-model call; +1 revision call only on failure).
    self_check: bool = True
    upload_dir: str = "./uploads"
    # Upload guards: reject oversized files outright, and cap how many pages get
    # the expensive OCR fallback (text-layer pages are cheap and stay uncapped).
    max_upload_mb: int = 25
    max_ocr_pages: int = 100

    # Google OAuth (optional — Google login is enabled only when these are set).
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    # Where the backend sends the user back to after Google login (frontend origin).
    frontend_url: str = "http://localhost:3000"
    # Comma-separated list of allowed CORS origins for the API.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # env_file is relative to the process CWD (run uvicorn from backend/).
    # extra="ignore" so stray env vars never break startup.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
