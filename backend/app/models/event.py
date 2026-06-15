"""Event models for published races / results and event-wide analysis."""
from __future__ import annotations

from datetime import date as date_type
from typing import List, Optional

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    discipline: Mapped[str] = mapped_column(String(32), default="orienteering")
    date: Mapped[Optional[date_type]] = mapped_column(Date)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    organiser_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    club_id: Mapped[Optional[str]] = mapped_column(ForeignKey("clubs.id"))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft/processing/published
    results_key: Mapped[Optional[str]] = mapped_column(String(512))

    entries: Mapped[List["EventEntry"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    analysis: Mapped[Optional["EventAnalysis"]] = relationship(
        back_populates="event", uselist=False, cascade="all, delete-orphan"
    )


class EventEntry(Base, TimestampMixin):
    __tablename__ = "event_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), index=True)
    athlete_id: Mapped[Optional[str]] = mapped_column(ForeignKey("athletes.id"))
    race_id: Mapped[Optional[str]] = mapped_column(ForeignKey("races.id"))
    competitor_name: Mapped[Optional[str]] = mapped_column(String(255))
    course: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    position: Mapped[Optional[int]] = mapped_column(Integer)
    total_time_s: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default="ok")  # ok/dnf/dsq/mp
    # True once a GPS track has been matched to this competitor's result.
    matched_gps: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped["Event"] = relationship(back_populates="entries")


class EventAnalysis(Base, TimestampMixin):
    """Event-wide aggregate analysis (leaderboards, leg rankings, route compare)."""

    __tablename__ = "event_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    # {course: [{position, name, total_time_s, behind_s}]}
    leaderboards: Mapped[dict] = mapped_column(JSON, default=dict)
    # {course: [{leg, from, to, best_s, rankings:[{name, time_s, rank, behind_s}]}]}
    leg_rankings: Mapped[dict] = mapped_column(JSON, default=dict)
    # {course: [{leg, competitors:[{name, distance_m, efficiency}]}]}
    route_comparison: Mapped[dict] = mapped_column(JSON, default=dict)
    stats: Mapped[dict] = mapped_column(JSON, default=dict)

    event: Mapped["Event"] = relationship(back_populates="analysis")
