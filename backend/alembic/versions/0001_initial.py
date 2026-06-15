"""Initial schema — core RouteForge tables.

Baseline migration materializing the core (athlete-centric) schema. The
ecosystem expansion (events analysis, coaching, teams, training, sharing) is
added by revision 0002.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-15
"""
import app.models  # noqa: F401  (register models on metadata)
from alembic import op
from app.database import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

# Tables that make up the original core schema.
CORE_TABLES = [
    "users", "athletes", "clubs", "club_memberships",
    "races", "map_assets", "gps_tracks", "split_sets", "controls",
    "analyses", "route_segments", "mistakes",
    "subscriptions", "events", "event_entries",
    "audit_logs", "uploads",
]


def _tables(names):
    return [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, tables=_tables(CORE_TABLES), checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, tables=_tables(CORE_TABLES))
