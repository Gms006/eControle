"""Make unique(protocolo,tipo) partial on processos_avulsos."""
from __future__ import annotations

from alembic import op


revision = "20251029_02_proc_avulsos_protocolo_partial"
down_revision = "20251029_01_uq_proc_avulsos_doc_tipo_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # remove o índice antigo (total) se existir
    op.execute("DROP INDEX IF EXISTS uq_proc_avulso_protocolo_tipo")
    # recria como PARCIAL: só quando protocolo não é nulo
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_avulso_protocolo_tipo
        ON processos_avulsos (protocolo, tipo)
        WHERE protocolo IS NOT NULL
        """
    )


def downgrade() -> None:
    # volta ao modelo antigo (NÃO recomendado, mas garante downgrade)
    op.execute("DROP INDEX IF EXISTS uq_proc_avulso_protocolo_tipo")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_avulso_protocolo_tipo
        ON processos_avulsos (protocolo, tipo)
        """
    )
