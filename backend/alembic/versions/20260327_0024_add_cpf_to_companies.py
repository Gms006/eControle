"""add cpf support to companies

Revision ID: 20260327_0024
Revises: 20260327_0023
Create Date: 2026-03-27 12:20:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260327_0024"
down_revision: str | None = "20260327_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("cpf", sa.String(length=14), nullable=True))
        batch_op.alter_column("cnpj", existing_type=sa.String(length=18), nullable=True)
        batch_op.create_unique_constraint("uq_companies_org_cpf", ["org_id", "cpf"])
        batch_op.create_index("ix_companies_org_id_cpf", ["org_id", "cpf"], unique=False)
        batch_op.create_check_constraint(
            "ck_companies_exactly_one_document",
            "(cnpj IS NOT NULL AND cpf IS NULL) OR (cnpj IS NULL AND cpf IS NOT NULL)",
        )


def downgrade() -> None:
    bind = op.get_bind()
    cpf_rows = bind.execute(sa.text("SELECT COUNT(*) FROM companies WHERE cpf IS NOT NULL")).scalar_one()
    if cpf_rows:
        raise RuntimeError("Cannot downgrade while CPF companies exist")

    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_constraint("ck_companies_exactly_one_document", type_="check")
        batch_op.drop_index("ix_companies_org_id_cpf")
        batch_op.drop_constraint("uq_companies_org_cpf", type_="unique")
        batch_op.drop_column("cpf")
        batch_op.alter_column("cnpj", existing_type=sa.String(length=18), nullable=False)
