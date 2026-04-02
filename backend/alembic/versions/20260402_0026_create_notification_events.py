"""create notification events table

Revision ID: 20260402_0026
Revises: 20260401_0025
Create Date: 2026-04-02 09:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260402_0026"
down_revision: str | None = "20260401_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("route_path", sa.String(length=255), nullable=True),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "dedupe_key", name="uq_notification_events_org_dedupe_key"),
    )
    op.create_index(
        "ix_notification_events_org_read_created",
        "notification_events",
        ["org_id", "read_at", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notification_events_org_created",
        "notification_events",
        ["org_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_events_org_created", table_name="notification_events")
    op.drop_index("ix_notification_events_org_read_created", table_name="notification_events")
    op.drop_table("notification_events")
