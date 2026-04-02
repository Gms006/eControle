"""create notification operational scan runs table

Revision ID: 20260402_0027
Revises: 20260402_0026
Create Date: 2026-04-02 11:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260402_0027"
down_revision: str | None = "20260402_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_operational_scan_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("started_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("processed", sa.Integer(), nullable=False),
        sa.Column("emitted_count", sa.Integer(), nullable=False),
        sa.Column("deduped_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=800), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notification_operational_scan_runs_org_id",
        "notification_operational_scan_runs",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_notification_operational_scan_runs_status",
        "notification_operational_scan_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_notification_operational_scan_runs_started_at",
        "notification_operational_scan_runs",
        ["started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_operational_scan_runs_started_at", table_name="notification_operational_scan_runs")
    op.drop_index("ix_notification_operational_scan_runs_status", table_name="notification_operational_scan_runs")
    op.drop_index("ix_notification_operational_scan_runs_org_id", table_name="notification_operational_scan_runs")
    op.drop_table("notification_operational_scan_runs")
