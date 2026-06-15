"""Event/coach/club/training/sharing ecosystem schema.

Adds the tables introduced by the ecosystem expansion:
  * event_analyses        — event-wide aggregate analysis
  * coach_athletes, teams, team_memberships, coach_notes — coaching/teams
  * training_sessions, goals, personal_bests — training analytics
  * share_links           — public sharing tokens

The expanded columns on ``events`` / ``event_entries`` are part of the model
metadata and are created with those tables in the baseline; this revision is
purely additive and preserves existing API/data compatibility.

Revision ID: 0002_ecosystem
Revises: 0001_initial
Create Date: 2026-06-15
"""
import app.models  # noqa: F401  (register models on metadata)
from alembic import op
from app.database import Base

revision = "0002_ecosystem"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

NEW_TABLES = [
    "event_analyses",
    "coach_athletes", "teams", "team_memberships", "coach_notes",
    "training_sessions", "goals", "personal_bests",
    "share_links",
]


def _tables(names):
    return [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, tables=_tables(NEW_TABLES), checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, tables=_tables(NEW_TABLES))
