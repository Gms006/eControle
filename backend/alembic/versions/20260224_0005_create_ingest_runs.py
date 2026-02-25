"""create ingest_runs

Revision ID: 20260224_0005
Revises: 20260219_0004
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260224_0005"
down_revision = "20260219_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingest_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("dataset", sa.String(length=64), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=True),
        sa.Column("source_name", sa.String(length=255), nullable=True),
        sa.Column("source_version", sa.String(length=64), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_hash", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'SUCCESS'"), nullable=False),
        sa.Column("stats", sa.JSON(), nullable=True),
        sa.Column("error", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ingest_runs_org_id", "ingest_runs", ["org_id"], unique=False)
    op.create_index("ix_ingest_runs_dataset", "ingest_runs", ["dataset"], unique=False)
    op.create_index("ix_ingest_runs_source_hash", "ingest_runs", ["source_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ingest_runs_source_hash", table_name="ingest_runs")
    op.drop_index("ix_ingest_runs_dataset", table_name="ingest_runs")
    op.drop_index("ix_ingest_runs_org_id", table_name="ingest_runs")
    op.drop_table("ingest_runs")
