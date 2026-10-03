from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import get_settings

settings = get_settings()

# ---- Normalize the database URL ----
# Neon / Heroku / Render sometimes give `postgres://` which SQLAlchemy 2.x
# rejects. Convert to `postgresql://` and ensure the psycopg2 driver is used.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)
if _db_url.startswith("postgresql://") and "+psycopg2" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# SQLite needs check_same_thread=False when used with FastAPI; Postgres doesn't.
_connect_args = (
    {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
)

engine = create_engine(
    _db_url,
    connect_args=_connect_args,
    pool_pre_ping=True,   # keeps Neon connections alive
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()