"""create cnae_risk_suggestions table

Revision ID: 20260320_0021
Revises: 20260313_0020
Create Date: 2026-03-20 09:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_0021"
down_revision: str | None = "20260313_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cnae_risk_suggestions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=True),
        sa.Column("cnae_code", sa.String(length=16), nullable=False),
        sa.Column("suggested_risk_tier", sa.String(length=16), nullable=True),
        sa.Column("suggested_base_weight", sa.Integer(), nullable=True),
        sa.Column("suggested_sanitary_risk", sa.String(length=16), nullable=True),
        sa.Column("suggested_fire_risk", sa.String(length=16), nullable=True),
        sa.Column("suggested_environmental_risk", sa.String(length=16), nullable=True),
        sa.Column("source_name", sa.String(length=128), nullable=False),
        sa.Column("source_reference", sa.String(length=512), nullable=True),
        sa.Column("evidence_excerpt", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", sa.String(length=36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status in ('PENDING','APPROVED','REJECTED','APPLIED')",
            name="ck_cnae_risk_suggestions_status",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cnae_risk_suggestions_org_id", "cnae_risk_suggestions", ["org_id"], unique=False)
    op.create_index("ix_cnae_risk_suggestions_cnae_code", "cnae_risk_suggestions", ["cnae_code"], unique=False)
    op.create_index("ix_cnae_risk_suggestions_status", "cnae_risk_suggestions", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cnae_risk_suggestions_status", table_name="cnae_risk_suggestions")
    op.drop_index("ix_cnae_risk_suggestions_cnae_code", table_name="cnae_risk_suggestions")
    op.drop_index("ix_cnae_risk_suggestions_org_id", table_name="cnae_risk_suggestions")
    op.drop_table("cnae_risk_suggestions")
