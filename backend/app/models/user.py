"""User, athlete, and club models."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    # roles: athlete, coach, club_admin, admin
    role: Mapped[str] = mapped_column(String(32), default="athlete", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    athlete: Mapped[Optional["Athlete"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    races: Mapped[List["Race"]] = relationship(back_populates="owner")  # noqa: F821


class Athlete(Base, TimestampMixin):
    __tablename__ = "athletes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    handle: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(64))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="athlete")
    club_memberships: Mapped[List["ClubMembership"]] = relationship(
        back_populates="athlete", cascade="all, delete-orphan"
    )


class Club(Base, TimestampMixin):
    __tablename__ = "clubs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(64))
    owner_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))

    memberships: Mapped[List["ClubMembership"]] = relationship(
        back_populates="club", cascade="all, delete-orphan"
    )


class ClubMembership(Base, TimestampMixin):
    __tablename__ = "club_memberships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    club_id: Mapped[str] = mapped_column(ForeignKey("clubs.id"))
    athlete_id: Mapped[str] = mapped_column(ForeignKey("athletes.id"))
    role: Mapped[str] = mapped_column(String(32), default="member")  # member, coach, admin

    club: Mapped["Club"] = relationship(back_populates="memberships")
    athlete: Mapped["Athlete"] = relationship(back_populates="club_memberships")
