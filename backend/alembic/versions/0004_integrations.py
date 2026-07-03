"""Integration tokens table (Strava OAuth).

Adds ``integration_tokens`` — per-user OAuth credentials for external
providers, stored server-side to power the Strava activity import.

Revision ID: 0004_integrations
Revises: 0003_feedback
Create Date: 2026-07-02
"""
import app.models  # noqa: F401  (register models on metadata)
from alembic import op
from app.database import Base

revision = "0004_integrations"
down_revision = "0003_feedback"
branch_labels = None
depends_on = None

NEW_TABLES = ["integration_tokens"]


def _tables(names):
    return [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, tables=_tables(NEW_TABLES), checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, tables=_tables(NEW_TABLES))
