"""create tax_portal_sync_runs

Revision ID: 20260325_0022
Revises: 20260320_0021
Create Date: 2026-03-25 15:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260325_0022"
down_revision = "20260320_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tax_portal_sync_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("started_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("trigger_type", sa.String(length=32), nullable=False),
        sa.Column("dry_run", sa.Boolean(), nullable=False),
        sa.Column("municipio", sa.String(length=128), nullable=True),
        sa.Column("limit", sa.Integer(), nullable=True),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("processed", sa.Integer(), nullable=False),
        sa.Column("ok_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("skipped_count", sa.Integer(), nullable=False),
        sa.Column("relogin_count", sa.Integer(), nullable=False),
        sa.Column("current_cnpj", sa.String(length=32), nullable=True),
        sa.Column("current_company_id", sa.String(length=36), nullable=True),
        sa.Column("errors", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["current_company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["started_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tax_portal_sync_runs_org_id", "tax_portal_sync_runs", ["org_id"], unique=False)
    op.create_index("ix_tax_portal_sync_runs_status", "tax_portal_sync_runs", ["status"], unique=False)
    op.create_index("ix_tax_portal_sync_runs_started_at", "tax_portal_sync_runs", ["started_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tax_portal_sync_runs_started_at", table_name="tax_portal_sync_runs")
    op.drop_index("ix_tax_portal_sync_runs_status", table_name="tax_portal_sync_runs")
    op.drop_index("ix_tax_portal_sync_runs_org_id", table_name="tax_portal_sync_runs")
    op.drop_table("tax_portal_sync_runs")