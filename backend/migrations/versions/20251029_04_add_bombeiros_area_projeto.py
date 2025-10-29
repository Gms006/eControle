"""Add area_m2 and projeto to processos / processos_avulsos (BOMBEIROS)."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20251029_04_add_bombeiros_area_projeto"
down_revision = "20251029_02_proc_avulsos_protocolo_partial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("processos", sa.Column("area_m2", sa.Numeric(12, 2), nullable=True))
    op.add_column("processos", sa.Column("projeto", sa.String(length=120), nullable=True))

    op.add_column("processos_avulsos", sa.Column("area_m2", sa.Numeric(12, 2), nullable=True))
    op.add_column("processos_avulsos", sa.Column("projeto", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("processos_avulsos", "projeto")
    op.drop_column("processos_avulsos", "area_m2")
    op.drop_column("processos", "projeto")
    op.drop_column("processos", "area_m2")
