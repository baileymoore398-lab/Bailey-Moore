"""Analysis result models."""
from __future__ import annotations

import enum
from typing import List, Optional

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class AnalysisStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    complete = "complete"
    failed = "failed"


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    race_id: Mapped[str] = mapped_column(ForeignKey("races.id"), unique=True)
    status: Mapped[str] = mapped_column(String(32), default=AnalysisStatus.pending.value)
    error: Mapped[Optional[str]] = mapped_column(Text)

    # Aggregate metrics (distance, time, pace, climb...) stored as JSON.
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    # Performance scores 0-100.
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    # AI coach report.
    coach: Mapped[dict] = mapped_column(JSON, default=dict)
    # Confidence summary {map, ocr, gps_alignment}.
    confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    # Enriched, replay-ready track points [{lat, lon, ele, t, speed_kmh}].
    track: Mapped[list] = mapped_column(JSON, default=list)
    # Per-leg analysis (denormalized for fast reads).
    legs: Mapped[list] = mapped_column(JSON, default=list)

    video_key: Mapped[Optional[str]] = mapped_column(String(512))

    race: Mapped["Race"] = relationship(back_populates="analysis")  # noqa: F821
    segments: Mapped[List["RouteSegment"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    mistakes: Mapped[List["Mistake"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )


class RouteSegment(Base, TimestampMixin):
    """A leg between two controls with its measured + optimal route metrics."""

    __tablename__ = "route_segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id"))
    leg_number: Mapped[int] = mapped_column(Integer)
    from_control: Mapped[str] = mapped_column(String(16))
    to_control: Mapped[str] = mapped_column(String(16))
    time_s: Mapped[float] = mapped_column(Float, default=0.0)
    best_time_s: Mapped[Optional[float]] = mapped_column(Float)
    time_loss_s: Mapped[float] = mapped_column(Float, default=0.0)
    rank: Mapped[Optional[int]] = mapped_column(Integer)
    pct_behind: Mapped[Optional[float]] = mapped_column(Float)
    distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    optimal_distance_m: Mapped[Optional[float]] = mapped_column(Float)
    climb_m: Mapped[float] = mapped_column(Float, default=0.0)

    analysis: Mapped["Analysis"] = relationship(back_populates="segments")


class Mistake(Base, TimestampMixin):
    __tablename__ = "mistakes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analyses.id"))
    # stop, hesitation, relocation, overshoot, route_change, direction_error, map_contact_loss
    type: Mapped[str] = mapped_column(String(32))
    leg_number: Mapped[Optional[int]] = mapped_column(Integer)
    t_start: Mapped[float] = mapped_column(Float)  # epoch seconds
    t_end: Mapped[float] = mapped_column(Float)
    lost_s: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(16), default="low")
    description: Mapped[Optional[str]] = mapped_column(Text)

    analysis: Mapped["Analysis"] = relationship(back_populates="mistakes")
