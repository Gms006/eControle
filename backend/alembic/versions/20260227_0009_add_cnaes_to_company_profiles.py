"""add cnaes fields to company_profiles

Revision ID: 20260227_0009
Revises: 20260226_0008
Create Date: 2026-02-27
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_0009"
down_revision = "20260226_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_profiles", sa.Column("cnaes_principal", sa.JSON(), nullable=True))
    op.add_column("company_profiles", sa.Column("cnaes_secundarios", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("company_profiles", "cnaes_secundarios")
    op.drop_column("company_profiles", "cnaes_principal")

