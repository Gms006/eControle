"""Add unique constraints for UPSERTs."""
from __future__ import annotations

from alembic import op

revision = "20251024_02_add_uniques_for_upsert"
down_revision = "20251024_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_licencas_empresa_tipo",
        "licencas",
        ["empresa_id", "tipo"],
    )
    op.create_unique_constraint(
        "uq_taxas_empresa_tipo",
        "taxas",
        ["empresa_id", "tipo"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_taxas_empresa_tipo", "taxas", type_="unique")
    op.drop_constraint("uq_licencas_empresa_tipo", "licencas", type_="unique")
