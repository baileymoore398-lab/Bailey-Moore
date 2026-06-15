"""Subscription / billing models."""
from __future__ import annotations

import enum
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class Plan(str, enum.Enum):
    free = "free"
    pro = "pro"
    club = "club"
    event = "event"


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    plan: Mapped[str] = mapped_column(String(32), default=Plan.free.value)
    status: Mapped[str] = mapped_column(String(32), default="active")
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128))
    # Usage counter for quota enforcement (reset monthly by a scheduled job).
    analyses_used: Mapped[int] = mapped_column(Integer, default=0)
    period_label: Mapped[Optional[str]] = mapped_column(String(16))  # e.g. "2026-06"
