import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import auth, users, jobs, applications, ai

settings = get_settings()

# Create tables on startup (safe to run repeatedly).
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME)

# ---------------------------------------------------------------------------
# CORS configuration
# ---------------------------------------------------------------------------
# The frontend (Vercel) and backend (Render) live on different origins, so
# every browser request triggers a CORS preflight. We allow the configured
# origins, or "*" if unset.
#
# IMPORTANT: allow_credentials MUST be False when allow_origins is ["*"] —
# browsers reject that combination per the CORS spec. Since ShiftHub uses
# JWT Bearer tokens (not cookies), credentials are not needed.
# ---------------------------------------------------------------------------
origins = settings.cors_origins_list
print(f"🌐 CORS allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,   # ← Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# API routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(ai.router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "ok",
        "environment": settings.APP_ENV,
        "cors_origins": origins,
    }


@app.get("/health")
def health():
    return {"status": "healthy"}