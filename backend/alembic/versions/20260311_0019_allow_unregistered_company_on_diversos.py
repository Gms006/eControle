"""allow company_processes.company_id nullable for unregistered DIVERSOS flow

Revision ID: 20260311_0019
Revises: 20260311_0018
Create Date: 2026-03-11 16:30:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260311_0019"
down_revision: str | None = "20260311_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("company_processes") as batch_op:
        batch_op.alter_column("company_id", existing_type=sa.String(length=36), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("company_processes") as batch_op:
        batch_op.alter_column("company_id", existing_type=sa.String(length=36), nullable=False)
