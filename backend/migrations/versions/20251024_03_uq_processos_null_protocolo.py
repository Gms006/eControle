"""Unique index for processos with NULL protocolo."""
from __future__ import annotations

from alembic import op

revision = "20251024_03_uq_processos_null_protocolo"
down_revision = "20251024_02_add_uniques_for_upsert"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo
        ON processos (empresa_id, tipo, data_solicitacao)
        WHERE protocolo IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo"
    )
