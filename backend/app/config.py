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
    # Master on/off (kept on except in the test suite, which sets ENV=test).
    RATE_LIMIT_ENABLED: bool = True
    # Optional shared backend so limits hold across multiple API instances.
    # Set to your Redis URL in production (e.g. ${REDIS_URL}); blank = in-memory
    # per-process counters (fine for a single instance / local dev).
    RATE_LIMIT_STORAGE_URI: str | None = None

    @field_validator("RATE_LIMIT_STORAGE_URI", mode="before")
    @classmethod
    def _blank_ratelimit_uri(cls, v):
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

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
    FREE_PLAN_MONTHLY_ANALYSES: int = 5

    # --- Admin ---
    # Comma-separated emails granted admin/superuser access on sign-in — used to
    # gate owner-only views such as the AI feedback results. Set this to your own
    # email so only you can see the feedback dashboard.
    ADMIN_EMAILS: str = "route.forge.official@gmail.com"

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in (self.ADMIN_EMAILS or "").split(",") if e.strip()}

    # --- Third-party integrations ---
    STRAVA_CLIENT_ID: str | None = None
    STRAVA_CLIENT_SECRET: str | None = None
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None

    # --- PayPal (alternative to Stripe for memberships) ---
    # PAYPAL_ENV: "sandbox" while testing, "live" for real money. Create a
    # monthly subscription Plan per tier in the PayPal dashboard and paste the
    # Plan IDs. Memberships stay "coming soon" until CLIENT_ID + SECRET are set.
    PAYPAL_ENV: str = "sandbox"
    PAYPAL_CLIENT_ID: str | None = None
    PAYPAL_SECRET: str | None = None
    PAYPAL_PLAN_PRO: str | None = None
    PAYPAL_PLAN_TEAM: str | None = None
    PAYPAL_PLAN_CLUB: str | None = None

    @field_validator(
        "PAYPAL_CLIENT_ID", "PAYPAL_SECRET",
        "PAYPAL_PLAN_PRO", "PAYPAL_PLAN_TEAM", "PAYPAL_PLAN_CLUB",
        mode="before",
    )
    @classmethod
    def _blank_paypal_to_none(cls, v):
        if v is None or not str(v).strip():
            return None
        return str(v).strip()

    @property
    def paypal_configured(self) -> bool:
        return bool(self.PAYPAL_CLIENT_ID and self.PAYPAL_SECRET)

    @property
    def paypal_api_base(self) -> str:
        return (
            "https://api-m.paypal.com"
            if self.PAYPAL_ENV == "live"
            else "https://api-m.sandbox.paypal.com"
        )

    @property
    def paypal_plan_ids(self) -> dict:
        return {
            "pro": self.PAYPAL_PLAN_PRO,
            "team": self.PAYPAL_PLAN_TEAM,
            "club": self.PAYPAL_PLAN_CLUB,
        }

    # --- Memberships master switch ---
    # Off by default: even with Stripe/PayPal keys configured, memberships stay
    # in "coming soon" mode and everything is free & unlimited. Flip to true
    # (MEMBERSHIPS_ENABLED=true on the API service) to show the buy buttons and
    # start enforcing free-plan limits.
    MEMBERSHIPS_ENABLED: bool = False

    @property
    def memberships_live(self) -> bool:
        """True only when the switch is on AND a payment provider is configured."""
        return self.MEMBERSHIPS_ENABLED and (
            bool(self.STRIPE_SECRET_KEY) or self.paypal_configured
        )

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
    # Resend (https://resend.com) HTTP API — preferred when set, as it's more
    # reliable from cloud hosts than SMTP. Falls back to SMTP, then to logging.
    RESEND_API_KEY: str | None = None
    # Public URL of the frontend, used to build links in emails (e.g. reset).
    FRONTEND_URL: str = "http://localhost:3000"

    @field_validator(
        "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "RESEND_API_KEY",
        mode="before",
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
        """True when any transport (Resend or SMTP) is configured for sending."""
        return bool(
            self.RESEND_API_KEY
            or (self.SMTP_HOST and (self.EMAIL_FROM or self.SMTP_USER))
        )

    @property
    def email_from_addr(self) -> str:
        # Resend's shared sender works without domain verification for testing.
        default = "onboarding@resend.dev" if self.RESEND_API_KEY else "no-reply@routeforge.world"
        return self.EMAIL_FROM or self.SMTP_USER or default

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
