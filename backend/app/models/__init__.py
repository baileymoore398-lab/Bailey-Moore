"""ORM models for RouteForge.

Importing this package registers every model on the shared declarative
``Base.metadata`` so Alembic autogeneration and ``create_all`` see them.
"""
from app.models.analysis import Analysis, AnalysisStatus, Mistake, RouteSegment
from app.models.base import TimestampMixin, gen_uuid
from app.models.event import Event, EventEntry
from app.models.race import Control, GpsTrack, MapAsset, Race, RaceStatus, SplitSet
from app.models.subscription import Plan, Subscription
from app.models.system import AuditLog, Upload
from app.models.user import Athlete, Club, ClubMembership, User

__all__ = [
    "TimestampMixin",
    "gen_uuid",
    "User",
    "Athlete",
    "Club",
    "ClubMembership",
    "Race",
    "MapAsset",
    "GpsTrack",
    "SplitSet",
    "Control",
    "RaceStatus",
    "Analysis",
    "RouteSegment",
    "Mistake",
    "AnalysisStatus",
    "Subscription",
    "Plan",
    "Event",
    "EventEntry",
    "AuditLog",
    "Upload",
]
