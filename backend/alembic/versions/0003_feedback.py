"""AI coach feedback table.

Adds ``analysis_feedback`` — thumbs up/down ratings and comments on AI coach
reports, used for the owner-only feedback dashboard and the learning loop.

Revision ID: 0003_feedback
Revises: 0002_ecosystem
Create Date: 2026-07-02
"""
import app.models  # noqa: F401  (register models on metadata)
from alembic import op
from app.database import Base

revision = "0003_feedback"
down_revision = "0002_ecosystem"
branch_labels = None
depends_on = None

NEW_TABLES = ["analysis_feedback"]


def _tables(names):
    return [Base.metadata.tables[n] for n in names if n in Base.metadata.tables]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, tables=_tables(NEW_TABLES), checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, tables=_tables(NEW_TABLES))
