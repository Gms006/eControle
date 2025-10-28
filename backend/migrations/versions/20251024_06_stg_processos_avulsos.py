"""Create staging table for processos_avulsos."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20251024_06_stg_processos_avulsos"
down_revision = "20251024_05_create_processos_avulsos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    table_name = "stg_processos_avulsos"
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
    op.create_index("idx_stg_processos_avulsos_run_id", table_name, ["run_id"])


def downgrade() -> None:
    op.drop_index("idx_stg_processos_avulsos_run_id", table_name="stg_processos_avulsos")
    op.drop_table("stg_processos_avulsos")
