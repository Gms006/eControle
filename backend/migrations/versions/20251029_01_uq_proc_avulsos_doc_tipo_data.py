"""Add unique constraint to processos_avulsos on documento, tipo, data_solicitacao."""
from __future__ import annotations

from alembic import op


revision = "20251029_01_uq_proc_avulsos_doc_tipo_data"
down_revision = "20251028_01_empresas_doc_relax_and_normalize"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_proc_avulsos_doc_tipo_data",
        "processos_avulsos",
        ["documento", "tipo", "data_solicitacao"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_proc_avulsos_doc_tipo_data",
        "processos_avulsos",
        type_="unique",
    )
