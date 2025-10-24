"""Create staging tables for ETL v2."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20251024_01_create_staging"
down_revision = "20250101_01"
branch_labels = None
depends_on = None


STAGING_TABLES = (
    "empresas",
    "licencas",
    "taxas",
    "processos",
    "certificados",
    "certificados_agendamentos",
)


def _create_staging_table(name: str) -> None:
    table_name = f"stg_{name}"
    op.create_table(
        table_name,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("file_source", sa.String(length=255), nullable=False),
        sa.Column("row_number", sa.Integer, nullable=False),
        sa.Column("row_hash", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(f"idx_{table_name}_run_id", table_name, ["run_id"])


def upgrade() -> None:
    for table in STAGING_TABLES:
        _create_staging_table(table)


def downgrade() -> None:
    for table in reversed(STAGING_TABLES):
        table_name = f"stg_{table}"
        op.drop_index(f"idx_{table_name}_run_id", table_name=table_name)
        op.drop_table(table_name)
