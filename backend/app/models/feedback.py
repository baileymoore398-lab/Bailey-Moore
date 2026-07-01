"""User feedback on AI coach reports.

Captures a thumbs-up / thumbs-down (and optional comment) for each analysis,
plus a snapshot of the report context. Highly-rated reports are later fed back
to the AI as style exemplars, so the coach improves from real feedback.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class AnalysisFeedback(Base, TimestampMixin):
    __tablename__ = "analysis_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    # Kept decoupled (plain columns, no FK cascade) so feedback survives even if
    # a race/analysis is later removed, and to avoid touching other models.
    analysis_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    race_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)

    # "up" or "down".
    rating: Mapped[str] = mapped_column(String(8), index=True)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    # Snapshot of the rated report, for review and for learning.
    coach_generated_by: Mapped[Optional[str]] = mapped_column(String(64))
    coach_summary: Mapped[Optional[str]] = mapped_column(Text)
    discipline: Mapped[Optional[str]] = mapped_column(String(32), index=True)
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
