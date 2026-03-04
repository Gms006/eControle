"""create receitaws bulk sync runs table

Revision ID: 20260303_0015
Revises: 20260303_0014
Create Date: 2026-03-03 11:30:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260303_0015"
down_revision: str | None = "20260303_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "receitaws_bulk_sync_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("started_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("only_missing", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ok_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_cnpj", sa.String(length=18), nullable=True),
        sa.Column("current_company_id", sa.String(length=36), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("errors", sa.JSON(), nullable=True),
        sa.Column("changes_summary", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_receitaws_bulk_sync_runs_org_id", "receitaws_bulk_sync_runs", ["org_id"])
    op.create_index(
        "ix_receitaws_bulk_sync_runs_started_by_user_id",
        "receitaws_bulk_sync_runs",
        ["started_by_user_id"],
    )
    op.create_index("ix_receitaws_bulk_sync_runs_status", "receitaws_bulk_sync_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_receitaws_bulk_sync_runs_status", table_name="receitaws_bulk_sync_runs")
    op.drop_index("ix_receitaws_bulk_sync_runs_started_by_user_id", table_name="receitaws_bulk_sync_runs")
    op.drop_index("ix_receitaws_bulk_sync_runs_org_id", table_name="receitaws_bulk_sync_runs")
    op.drop_table("receitaws_bulk_sync_runs")
