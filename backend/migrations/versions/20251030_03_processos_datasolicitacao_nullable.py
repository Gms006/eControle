"""Make processos.data_solicitacao nullable and align related indexes."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# IDs
revision = "20251030_03_processos_datasolicitacao_nullable"
down_revision = "20251030_02_processos_protocolo_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply processos data_solicitacao nullability and index adjustments."""
    op.alter_column(
        "processos",
        "data_solicitacao",
        existing_type=sa.Date(),
        nullable=True,
        schema=None,
    )

    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo")
    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_sem_data")
    op.execute("DROP INDEX IF EXISTS uq_proc_protocolo_tipo")

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_protocolo_tipo
        ON processos (protocolo, tipo)
        WHERE protocolo IS NOT NULL
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_sem_data
        ON processos (empresa_id, tipo)
        WHERE protocolo IS NULL AND data_solicitacao IS NULL
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_com_data
        ON processos (empresa_id, tipo, data_solicitacao)
        WHERE protocolo IS NULL AND data_solicitacao IS NOT NULL
        """
    )


def downgrade() -> None:
    """Revert processos data_solicitacao nullability and index adjustments."""
    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_com_data")
    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_sem_data")
    op.execute("DROP INDEX IF EXISTS uq_proc_protocolo_tipo")

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo
        ON processos (empresa_id, tipo, data_solicitacao)
        WHERE protocolo IS NULL
        """
    )

    op.alter_column(
        "processos",
        "data_solicitacao",
        existing_type=sa.Date(),
        nullable=False,
        schema=None,
    )
