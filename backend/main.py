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

# CORS — allow the deployed frontend to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    }


@app.get("/health")
def health():
    return {"status": "healthy"}