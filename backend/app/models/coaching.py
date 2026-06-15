"""Coaching and team models: coach↔athlete links, teams, and coach notes."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class CoachAthlete(Base, TimestampMixin):
    """Link between a coaching user and an athlete they coach."""

    __tablename__ = "coach_athletes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    coach_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/pending/ended


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    coach_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    club_id: Mapped[Optional[str]] = mapped_column(ForeignKey("clubs.id"))
    description: Mapped[Optional[str]] = mapped_column(Text)

    members: Mapped[List["TeamMembership"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )


class TeamMembership(Base, TimestampMixin):
    __tablename__ = "team_memberships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"))
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"))
    role: Mapped[str] = mapped_column(String(32), default="member")

    team: Mapped["Team"] = relationship(back_populates="members")


class CoachNote(Base, TimestampMixin):
    """A coach's note/feedback attached to an athlete and optionally a race."""

    __tablename__ = "coach_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    coach_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"), index=True)
    race_id: Mapped[Optional[str]] = mapped_column(ForeignKey("races.id"))
    body: Mapped[str] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(16), default="private")  # private/shared
