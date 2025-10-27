"""Unique index for processos without protocolo and data."""
from __future__ import annotations

from alembic import op

revision = "20251024_04_uq_proc_sem_proto_sem_data"
down_revision = "20251024_03_uq_processos_null_protocolo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_sem_protocolo_sem_data
        ON processos (empresa_id, tipo)
        WHERE protocolo IS NULL AND data_solicitacao IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS uq_proc_empresa_tipo_sem_protocolo_sem_data"
    )
