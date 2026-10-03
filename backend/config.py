from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ShiftHub"
    APP_ENV: str = "development"
    APP_BASE_URL: str = "http://localhost:8000"
    SECRET_KEY: str = "dev-secret-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str = "sqlite:///./shifthub.db"

    CORS_ORIGINS: str = "*"

    # ---- Gemini ----
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # ---- Groq ----
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ---- Brevo (HTTP API — preferred) ----
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "no-reply@shifthub.app"
    BREVO_SENDER_NAME: str = "ShiftHub"

    # ---- Brevo (SMTP — fallback for local dev only) ----
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@shifthub.app"
    SMTP_FROM_NAME: str = "ShiftHub"

    # ---- Cloudinary ----
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    MAX_UPLOAD_MB: int = 5

    @property
    def cors_origins_list(self) -> List[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw or raw == "*":
            return ["*"]
        out = []
        for o in raw.split(","):
            o = o.strip().rstrip("/")
            if o:
                out.append(o)
        return out

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()