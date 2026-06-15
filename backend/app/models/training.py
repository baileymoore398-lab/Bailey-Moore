"""Training analytics models: sessions, goals, personal bests."""
from __future__ import annotations

from datetime import date as date_type
from typing import Optional

from sqlalchemy import JSON, Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class TrainingSession(Base, TimestampMixin):
    """A single training activity (run/ride) with derived metrics.

    Built from an uploaded GPX/FIT track via the GPS engine, so training
    analytics reuse the same metric computation as race analysis.
    """

    __tablename__ = "training_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    date: Mapped[Optional[date_type]] = mapped_column(Date, index=True)
    sport: Mapped[str] = mapped_column(String(32), default="run")
    source: Mapped[str] = mapped_column(String(32), default="upload")
    track_key: Mapped[Optional[str]] = mapped_column(String(512))
    distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    moving_time_s: Mapped[float] = mapped_column(Float, default=0.0)
    climb_m: Mapped[float] = mapped_column(Float, default=0.0)
    avg_speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    avg_hr: Mapped[Optional[float]] = mapped_column(Float)
    max_hr: Mapped[Optional[float]] = mapped_column(Float)
    # Training load (TRIMP-style or duration*intensity) for load tracking.
    load: Mapped[float] = mapped_column(Float, default=0.0)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)


class Goal(Base, TimestampMixin):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    metric: Mapped[str] = mapped_column(String(32))  # distance_km/sessions/score/...
    target_value: Mapped[float] = mapped_column(Float, default=0.0)
    current_value: Mapped[float] = mapped_column(Float, default=0.0)
    period: Mapped[str] = mapped_column(String(16), default="month")  # week/month/season
    due_date: Mapped[Optional[date_type]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="active")
    notes: Mapped[Optional[str]] = mapped_column(Text)


class PersonalBest(Base, TimestampMixin):
    __tablename__ = "personal_bests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"), index=True)
    category: Mapped[str] = mapped_column(String(64))  # e.g. "5k_time", "longest_run"
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(16), default="s")
    race_id: Mapped[Optional[str]] = mapped_column(ForeignKey("races.id"))
    session_id: Mapped[Optional[str]] = mapped_column(ForeignKey("training_sessions.id"))
    achieved_on: Mapped[Optional[date_type]] = mapped_column(Date)
