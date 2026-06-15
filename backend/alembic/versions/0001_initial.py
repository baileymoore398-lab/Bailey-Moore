"""Initial schema — creates all RouteForge tables from model metadata.

This first migration materializes the full schema defined by the SQLAlchemy
models. Subsequent migrations should be generated with
``alembic revision --autogenerate`` and contain explicit operations.

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


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
