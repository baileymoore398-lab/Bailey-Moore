"""Add paypal_subscription_id to subscriptions (PayPal memberships).

Revision ID: 0005_paypal
Revises: 0004_integrations
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0005_paypal"
down_revision = "0004_integrations"
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "subscriptions", "paypal_subscription_id"):
        op.add_column(
            "subscriptions",
            sa.Column("paypal_subscription_id", sa.String(length=128), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "subscriptions", "paypal_subscription_id"):
        op.drop_column("subscriptions", "paypal_subscription_id")
