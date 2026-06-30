"""Application configuration loaded from environment variables.

All settings have sensible local-development defaults so the service can boot
without a fully provisioned environment. Production deployments override these
via environment variables / secrets.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- General ---
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    PROJECT_NAME: str = "RouteForge"
    API_V1_PREFIX: str = "/api/v1"

    # --- Database ---
    DATABASE_URL: str = "sqlite:///./routeforge.db"

    # --- Security ---
    JWT_SECRET: str = "dev-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # --- CORS ---
    # Stored as a raw string so pydantic-settings never tries to JSON-parse it
    # (a List-typed env var must be valid JSON, so a bare URL like
    # "https://app.example" would raise SettingsError and crash startup). Use the
    # ``cors_origins`` property to get the parsed list. Accepts a comma-separated
    # string or a JSON array.
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex to allow matching origins, e.g. r"https://.*\.vercel\.app".
    CORS_ORIGIN_REGEX: str | None = None

    # --- Rate limiting ---
    RATE_LIMIT_DEFAULT: str = "120/minute"

    # --- Storage (S3 / MinIO) ---
    S3_ENDPOINT: str | None = None  # e.g. http://minio:9000 for local
    S3_BUCKET: str = "routeforge"
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    S3_PUBLIC_URL: str | None = None
    # When no S3 is configured we fall back to local disk storage.
    LOCAL_STORAGE_DIR: str = "./storage_data"

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None
    # Worker process count. Kept small because each prefork child loads the heavy
    # CV/numeric stack; Celery's default (one per CPU core) OOM-kills the worker
    # on many-core hosts. Override via env for larger instances.
    CELERY_CONCURRENCY: int = 2
    # Run tasks inline (no broker) — handy for local dev / tests.
    CELERY_TASK_ALWAYS_EAGER: bool = True

    # --- AI ---
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # --- Subscriptions / quotas ---
    FREE_PLAN_MONTHLY_ANALYSES: int = 3

    # --- Third-party integrations ---
    STRAVA_CLIENT_ID: str | None = None
    STRAVA_CLIENT_SECRET: str | None = None
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None

    # --- Email (transactional, SMTP) ---
    # Leave SMTP_HOST blank to disable real sending: emails are logged instead
    # and (outside production) the reset token is returned in the API response so
    # the flow stays testable. For Gmail use host=smtp.gmail.com, port=587,
    # user=<your address>, password=<a Google app password>, from=<your address>.
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_STARTTLS: bool = True
    EMAIL_FROM: str | None = None
    EMAIL_FROM_NAME: str = "RouteForge"
    # Public URL of the frontend, used to build links in emails (e.g. reset).
    FRONTEND_URL: str = "http://localhost:3000"

    @field_validator(
        "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", mode="before"
    )
    @classmethod
    def _blank_to_none(cls, v):
        # Treat blank/whitespace env values as unset.
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("FRONTEND_URL", mode="before")
    @classmethod
    def _normalize_frontend_url(cls, v):
        if v is None or not str(v).strip():
            return "http://localhost:3000"
        return str(v).strip().rstrip("/")

    @property
    def email_enabled(self) -> bool:
        """True when an SMTP transport is configured for real sending."""
        return bool(self.SMTP_HOST and (self.EMAIL_FROM or self.SMTP_USER))

    @property
    def email_from_addr(self) -> str:
        return self.EMAIL_FROM or self.SMTP_USER or "no-reply@routeforge.app"

    @property
    def cors_origins(self) -> List[str]:
        """Parsed CORS allow-list. Accepts comma-separated or a JSON array."""
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                return [str(x).strip() for x in json.loads(raw) if str(x).strip()]
            except (ValueError, TypeError):
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_db_url(cls, v):
        """Normalize provider-supplied connection strings.

        * Trim whitespace; empty/blank → fall back to the SQLite default so the
          app still boots (a clear error is raised later if a real DB is needed).
        * Rewrite the bare ``postgres://`` / ``postgresql://`` schemes that
          Railway/Render/Heroku hand out to the explicit ``postgresql+psycopg2``
          dialect matching the installed driver.
        """
        if v is None:
            return "sqlite:///./routeforge.db"
        v = str(v).strip()
        if not v:
            return "sqlite:///./routeforge.db"
        if v.startswith("postgres://"):
            v = "postgresql+psycopg2://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def _normalize_redis_url(cls, v):
        # A blank value (e.g. an unresolved Railway reference) would leave Celery
        # with a hostless broker ("No hostname… reverting to localhost"). Fall
        # back to the sane local default so the URL is always well-formed.
        if v is None or not str(v).strip():
            return "redis://localhost:6379/0"
        return str(v).strip()

    @field_validator("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", mode="before")
    @classmethod
    def _blank_celery_to_none(cls, v):
        # Treat blank overrides as unset so they fall back to REDIS_URL.
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @property
    def celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
