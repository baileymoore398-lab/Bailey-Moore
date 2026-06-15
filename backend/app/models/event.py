"""Event models for published races / results."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    discipline: Mapped[str] = mapped_column(String(32), default="orienteering")
    date: Mapped[Optional["Date"]] = mapped_column(Date)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    organiser_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    club_id: Mapped[Optional[str]] = mapped_column(ForeignKey("clubs.id"))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)

    entries: Mapped[List["EventEntry"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class EventEntry(Base, TimestampMixin):
    __tablename__ = "event_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"))
    athlete_id: Mapped[Optional[str]] = mapped_column(ForeignKey("athletes.id"))
    race_id: Mapped[Optional[str]] = mapped_column(ForeignKey("races.id"))
    course: Mapped[Optional[str]] = mapped_column(String(64))
    position: Mapped[Optional[int]] = mapped_column()

    event: Mapped["Event"] = relationship(back_populates="entries")
