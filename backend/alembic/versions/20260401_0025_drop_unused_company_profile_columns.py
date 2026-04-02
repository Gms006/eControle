"""drop unused company_profile columns

Revision ID: 20260401_0025
Revises: 20260327_0024
Create Date: 2026-04-01 10:30:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260401_0025"
down_revision: str | None = "20260327_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.drop_column("debito_prefeitura")


def downgrade() -> None:
    with op.batch_alter_table("company_profiles") as batch_op:
        batch_op.add_column(sa.Column("debito_prefeitura", sa.String(length=512), nullable=True))
