"""SQLAlchemy engine, session, and declarative base.

Supports both PostgreSQL (production) and SQLite (zero-config local/dev/test).
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Guard against a misconfigured production database. If DATABASE_URL is unset or
# empty in production it normalizes to the SQLite default (see config.py), which
# would silently give the API and worker separate ephemeral databases. Fail loudly
# with an actionable message instead.
if settings.ENV == "production" and settings.DATABASE_URL.startswith("sqlite"):
    raise RuntimeError(
        "DATABASE_URL is not set (resolved to SQLite) but ENV=production. "
        "Set DATABASE_URL to your Postgres connection string. On Railway, open the "
        "API service → Variables and add a reference to your Postgres service, e.g. "
        "DATABASE_URL=${{Postgres.DATABASE_URL}} (match your Postgres service name)."
    )

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # Needed for SQLite when used across threads (uvicorn workers).
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Used for SQLite/dev; production uses Alembic."""
    # Import models so they are registered on the metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
