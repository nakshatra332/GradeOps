"""
config.py — Application settings loaded from .env / environment variables.

All pipeline code imports settings from here. Nothing reads os.environ directly.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── LLM ──────────────────────────────────────────────────
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")

    ocr_model: str       = Field(default="gemini-2.0-flash",        alias="OCR_MODEL")
    grading_model: str   = Field(default="gemini-1.5-pro",          alias="GRADING_MODEL")
    embedding_model: str = Field(default="models/text-embedding-004", alias="EMBEDDING_MODEL")

    # ── Thresholds ────────────────────────────────────────────
    ocr_confidence_threshold: float = Field(default=0.80, alias="OCR_CONFIDENCE_THRESHOLD")
    plagiarism_threshold: float     = Field(default=0.95, alias="PLAGIARISM_THRESHOLD")
    auto_approve_hours: int         = Field(default=48,   alias="AUTO_APPROVE_HOURS")

    # ── Storage ───────────────────────────────────────────────
    storage_backend: str   = Field(default="local",    alias="STORAGE_BACKEND")
    local_storage_path: str = Field(default="./scratch", alias="LOCAL_STORAGE_PATH")
    s3_bucket: str         = Field(default="",         alias="S3_BUCKET")
    gcs_bucket: str        = Field(default="",         alias="GCS_BUCKET")

    # ── Dev ───────────────────────────────────────────────────
    mock_llm: bool = Field(default=False, alias="MOCK_LLM")

    # ── Server ────────────────────────────────────────────────
    server_host: str  = Field(default="0.0.0.0",              alias="SERVER_HOST")
    server_port: int  = Field(default=8000,                    alias="SERVER_PORT")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


# Singleton — import this everywhere
settings = Settings()
