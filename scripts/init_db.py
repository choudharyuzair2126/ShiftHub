"""
Create all tables in the configured database.

Run once after setting DATABASE_URL:
    python scripts/init_db.py

Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS semantics.
"""
import sys
import os

# Allow importing the `backend` package when running from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import Base, engine
from backend import models  # noqa: F401 — registers all models with Base


def main():
    print(f"🔗 Using database: {engine.url.render_as_string(hide_password=True)}")
    print("🛠️  Creating tables…")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully!")


if __name__ == "__main__":
    main()