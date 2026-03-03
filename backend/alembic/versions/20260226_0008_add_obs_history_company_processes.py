"""add obs_history to company_processes

Revision ID: 20260226_0008
Revises: 20260224_0007
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

revision = "20260226_0008"
down_revision = "20260224_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_processes", sa.Column("obs_history", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("company_processes", "obs_history")
