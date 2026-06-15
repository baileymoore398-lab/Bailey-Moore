"""Public sharing models: tokenized share links for athletes/events/analyses."""
from __future__ import annotations

import secrets
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


def gen_token() -> str:
    return secrets.token_urlsafe(9)


class ShareLink(Base, TimestampMixin):
    """A revocable public link to a resource (race analysis, event, athlete)."""

    __tablename__ = "share_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    token: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=gen_token)
    resource_type: Mapped[str] = mapped_column(String(16))  # race/event/athlete
    resource_id: Mapped[str] = mapped_column(String(36), index=True)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_embed: Mapped[bool] = mapped_column(Boolean, default=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
