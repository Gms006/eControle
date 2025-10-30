"""Make processos.protocolo nullable and add unique index on (protocolo, tipo)."""
from alembic import op
import sqlalchemy as sa


# ajuste seus IDs conforme o encadeamento atual
revision = "20251030_02_processos_protocolo_nullable"
down_revision = "20251030_01_proc_avulsos_uq_protocolo_tipo_as_constraint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) permitir NULL
    op.alter_column(
        "processos",
        "protocolo",
        existing_type=sa.String(length=120),
        nullable=True,
    )

    # 2) normalizar placeholders para NULL (evita colisão em índices)
    op.execute(
        """
        UPDATE processos
           SET protocolo = NULL
         WHERE protocolo IN ('-', '*', '');
        """
    )

    # 3) índice único por (protocolo, tipo) — NULLs são permitidos e não conflitam
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_protocolo_tipo
            ON processos (protocolo, tipo);
        """
    )

    # 4) garanta que o índice parcial para casos SEM protocolo exista (se ainda não tiver)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo
            ON processos (empresa_id, tipo, data_solicitacao)
         WHERE protocolo IS NULL;
        """
    )


def downgrade() -> None:
    # drop do índice único por protocolo
    op.execute("DROP INDEX IF EXISTS uq_proc_protocolo_tipo")

    # voltar a proibir NULL (só se tiver certeza de que não há NULLs)
    op.execute(
        """
        UPDATE processos
           SET protocolo = ''
         WHERE protocolo IS NULL;
        """
    )
    op.alter_column(
        "processos",
        "protocolo",
        existing_type=sa.String(length=120),
        nullable=False,
    )
