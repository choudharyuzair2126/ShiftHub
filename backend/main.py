import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .config import get_settings
from .database import Base, engine
from .routers import auth, users, jobs, applications, ai, messages, notifications

settings = get_settings()
Base.metadata.create_all(bind=engine)


def _ensure_schema_columns():
    """Add new columns to existing tables if missing (lightweight migration)."""
    try:
        inspector = inspect(engine)
        with engine.begin() as conn:
            if inspector.has_table("users"):
                cols = {c["name"] for c in inspector.get_columns("users")}
                if "resume_text" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN resume_text TEXT DEFAULT ''"))
                if "education" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN education VARCHAR(200) DEFAULT ''"))
                if "experience_years" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN experience_years FLOAT DEFAULT 0"))
            if inspector.has_table("applications"):
                cols = {c["name"] for c in inspector.get_columns("applications")}
                if "cv_analysis" not in cols:
                    conn.execute(text("ALTER TABLE applications ADD COLUMN cv_analysis TEXT DEFAULT ''"))
    except Exception as e:
        print(f"⚠️  Schema migration check warning: {e}")


_ensure_schema_columns()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(os.path.join(uploads_dir, "resumes"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(ai.router)
app.include_router(messages.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "ok",
        "environment": settings.APP_ENV,
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
