"""create companies

Revision ID: 20260219_0004
Revises: 20260218_0003
Create Date: 2026-02-19 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260219_0004"
down_revision: Union[str, None] = "20260218_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("cnpj", sa.String(length=18), nullable=False),
        sa.Column("razao_social", sa.String(length=255), nullable=False),
        sa.Column("nome_fantasia", sa.String(length=255), nullable=True),
        sa.Column("municipio", sa.String(length=128), nullable=True),
        sa.Column("uf", sa.String(length=2), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["orgs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "cnpj", name="uq_companies_org_cnpj"),
    )
    op.create_index("ix_companies_org_id", "companies", ["org_id"], unique=False)
    op.create_index(
        "ix_companies_org_id_cnpj",
        "companies",
        ["org_id", "cnpj"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_companies_org_id_cnpj", table_name="companies")
    op.drop_index("ix_companies_org_id", table_name="companies")
    op.drop_table("companies")
