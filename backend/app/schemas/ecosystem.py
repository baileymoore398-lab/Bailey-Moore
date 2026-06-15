"""Schemas for the event / coach / club / training / sharing ecosystem."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel


# --- Events ---
class EventCreate(BaseModel):
    name: str
    discipline: str = "orienteering"
    date: Optional[date] = None
    location: Optional[str] = None
    description: Optional[str] = None


class EventOut(BaseModel):
    id: str
    name: str
    slug: str
    discipline: str
    status: str
    date: Optional[date] = None
    location: Optional[str] = None
    description: Optional[str] = None
    is_public: bool = True
    entry_count: int = 0
    matched_gps: int = 0
    has_analysis: bool = False

    model_config = {"from_attributes": True}


class EventEntryOut(BaseModel):
    id: str
    competitor_name: Optional[str]
    course: Optional[str]
    position: Optional[int]
    total_time_s: Optional[float]
    status: str
    matched_gps: bool
    race_id: Optional[str]


# --- Coaching ---
class LinkAthleteRequest(BaseModel):
    athlete_id: Optional[str] = None
    athlete_handle: Optional[str] = None


class CoachNoteCreate(BaseModel):
    athlete_id: str
    race_id: Optional[str] = None
    body: str
    visibility: str = "private"


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    club_id: Optional[str] = None


# --- Clubs ---
class ClubCreate(BaseModel):
    name: str
    country: Optional[str] = None


class ClubMemberAdd(BaseModel):
    athlete_id: Optional[str] = None
    athlete_handle: Optional[str] = None
    role: str = "member"


# --- Training ---
class GoalCreate(BaseModel):
    title: str
    metric: str = "distance_km"
    target_value: float = 0.0
    period: str = "month"
    due_date: Optional[date] = None


class TrainingSessionOut(BaseModel):
    id: str
    date: Optional[date]
    sport: str
    distance_m: float
    duration_s: float
    climb_m: float
    avg_speed_kmh: float
    avg_hr: Optional[float]
    load: float

    model_config = {"from_attributes": True}


# --- Sharing ---
class ShareCreate(BaseModel):
    resource_type: str  # race/event/athlete
    resource_id: str
    allow_embed: bool = True


class ShareOut(BaseModel):
    token: str
    url: str
    resource_type: str
    resource_id: str
    allow_embed: bool
    views: int

    model_config = {"from_attributes": True}
