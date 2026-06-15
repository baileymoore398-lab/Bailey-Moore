"""Application configuration loaded from environment variables.

All settings have sensible local-development defaults so the service can boot
without a fully provisioned environment. Production deployments override these
via environment variables / secrets.
"""
from __future__ import annotations

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
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

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
