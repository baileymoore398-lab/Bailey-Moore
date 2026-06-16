"""API request/response schemas."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    plan: str = "free"
    analyses_used: int = 0
    is_superuser: bool = False


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    handle: Optional[str] = None
    country: Optional[str] = None
    bio: Optional[str] = None
    is_public: Optional[bool] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


# --- Race ---
class RaceCreate(BaseModel):
    name: Optional[str] = None
    discipline: str = "orienteering"


class RaceOut(BaseModel):
    id: str
    name: str
    discipline: str
    status: str
    meta: dict = {}
    has_map: bool = False
    has_gps: bool = False
    has_splits: bool = False
    has_analysis: bool = False

    model_config = {"from_attributes": True}


class UploadOut(BaseModel):
    id: str
    kind: str
    filename: Optional[str] = None
    url: Optional[str] = None
    point_count: Optional[int] = None


class AnalyzeResponse(BaseModel):
    analysis_id: str
    race_id: str
    status: str


# --- Analysis ---
class MistakeOut(BaseModel):
    type: str
    leg_number: Optional[int] = None
    t_start: float
    t_end: float
    lost_s: float
    severity: str
    description: Optional[str] = None


class AnalysisOut(BaseModel):
    id: str
    race_id: str
    status: str
    error: Optional[str] = None
    metrics: dict = {}
    scores: dict = {}
    coach: dict = {}
    confidence: dict = {}
    track: List[dict] = []
    legs: List[dict] = []
    controls: List[dict] = []
    mistakes: List[MistakeOut] = []
    video_url: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Athlete ---
class AthleteStats(BaseModel):
    races: int = 0
    total_distance_km: float = 0.0
    total_climb_m: float = 0.0
    controls_visited: int = 0
    avg_overall_score: float = 0.0
    podiums: int = 0
    wins: int = 0


class AthleteProfileOut(BaseModel):
    id: Optional[str] = None
    display_name: str
    handle: Optional[str] = None
    country: Optional[str] = None
    bio: Optional[str] = None
    stats: AthleteStats
    trend: List[dict] = []  # [{race, overall, navigation, fitness, date}]


class VideoRequest(BaseModel):
    fmt: str = "tiktok"  # tiktok | reel | youtube
    duration_s: float = 15.0
