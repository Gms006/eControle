"""create cnae_risks table and add score snapshot fields to company_profiles

Revision ID: 20260313_0020
Revises: 20260311_0019
Create Date: 2026-03-13 12:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260313_0020"
down_revision: str | None = "20260311_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cnae_risks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cnae_code", sa.String(length=16), nullable=False),
        sa.Column("cnae_text", sa.String(length=512), nullable=False),
        sa.Column("risk_tier", sa.String(length=16), nullable=True),
        sa.Column("base_weight", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sanitary_risk", sa.String(length=16), nullable=True),
        sa.Column("fire_risk", sa.String(length=16), nullable=True),
        sa.Column("environmental_risk", sa.String(length=16), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cnae_code", name="uq_cnae_risks_cnae_code"),
    )
    op.create_index("ix_cnae_risks_cnae_code", "cnae_risks", ["cnae_code"], unique=False)
    op.create_index("ix_cnae_risks_is_active", "cnae_risks", ["is_active"], unique=False)

    op.add_column("company_profiles", sa.Column("risco_consolidado", sa.String(length=16), nullable=True))
    op.add_column("company_profiles", sa.Column("score_urgencia", sa.Integer(), nullable=True))
    op.add_column("company_profiles", sa.Column("score_status", sa.String(length=32), nullable=True))
    op.add_column("company_profiles", sa.Column("score_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("company_profiles", "score_updated_at")
    op.drop_column("company_profiles", "score_status")
    op.drop_column("company_profiles", "score_urgencia")
    op.drop_column("company_profiles", "risco_consolidado")

    op.drop_index("ix_cnae_risks_is_active", table_name="cnae_risks")
    op.drop_index("ix_cnae_risks_cnae_code", table_name="cnae_risks")
    op.drop_table("cnae_risks")
