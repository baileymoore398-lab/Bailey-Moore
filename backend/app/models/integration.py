"""Third-party integration credentials (e.g. Strava OAuth tokens)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class IntegrationToken(Base, TimestampMixin):
    """Per-user OAuth tokens for an external provider.

    Tokens live server-side only — they are never returned to the browser.
    """

    __tablename__ = "integration_tokens"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_integration_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    access_token: Mapped[str] = mapped_column(String(512), nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(512))
    # Epoch seconds when the access token expires.
    expires_at: Mapped[Optional[float]] = mapped_column(Float)

    # Provider-side identity, for display ("Connected as …").
    external_id: Mapped[Optional[str]] = mapped_column(String(64))
    external_name: Mapped[Optional[str]] = mapped_column(String(255))
