"""Relax processos/protocol constraints and align partial indexes."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20251030_02_processos_protocolo_nullable"
down_revision = "20251030_01_proc_avulsos_uq_protocolo_tipo_as_constraint"
branch_labels = None
depends_on = None

PLACEHOLDERS = ("-", "–", "—", "*", "n/a", "na", "não possui", "nao possui", "NA", "N/A", "")


def _nullify_placeholders(table: str, columns: list[str]) -> None:
    placeholders = ", ".join(f"'{value}'" for value in PLACEHOLDERS)
    for column in columns:
        op.execute(
            f"""
            UPDATE {table}
               SET {column} = NULL
             WHERE {column} IS NOT NULL
               AND lower(trim({column}::text)) IN ({placeholders});
            """
        )


def upgrade() -> None:
    _nullify_placeholders(
        "processos",
        [
            "protocolo",
            "status_padrao",
            "obs",
            "alvara",
            "municipio",
            "tpi",
            "inscricao_imobiliaria",
            "servico",
            "taxa",
            "notificacao",
            "projeto",
        ],
    )
    _nullify_placeholders(
        "processos_avulsos",
        [
            "protocolo",
            "status_padrao",
            "obs",
            "alvara",
            "municipio",
            "tpi",
            "inscricao_imobiliaria",
            "servico",
            "taxa",
            "notificacao",
            "projeto",
        ],
    )

    processos_column_types = {
        "protocolo": sa.String(length=120),
        "data_solicitacao": sa.Date(),
        "status_padrao": sa.String(length=120),
        "obs": sa.Text(),
        "alvara": postgresql.ENUM(name="alvara_funcionamento_enum", create_type=False),
        "municipio": sa.String(length=120),
        "tpi": sa.String(length=120),
        "inscricao_imobiliaria": sa.String(length=120),
        "servico": postgresql.ENUM(name="servico_sanitario_enum", create_type=False),
        "taxa": sa.String(length=120),
        "notificacao": postgresql.ENUM(name="notificacao_sanitaria_enum", create_type=False),
        "data_val": sa.Date(),
        "area_m2": sa.Numeric(12, 2),
        "projeto": sa.String(length=120),
    }
    for column, column_type in processos_column_types.items():
        op.alter_column("processos", column, existing_type=column_type, nullable=True)

    processos_avulsos_column_types = {
        "protocolo": sa.String(length=120),
        "data_solicitacao": sa.Date(),
        "status_padrao": sa.String(length=120),
        "obs": sa.Text(),
        "alvara": postgresql.ENUM(name="alvara_funcionamento_enum", create_type=False),
        "municipio": sa.String(length=120),
        "tpi": sa.String(length=120),
        "inscricao_imobiliaria": sa.String(length=120),
        "servico": postgresql.ENUM(name="servico_sanitario_enum", create_type=False),
        "taxa": sa.String(length=120),
        "notificacao": postgresql.ENUM(name="notificacao_sanitaria_enum", create_type=False),
        "data_val": sa.Date(),
        "area_m2": sa.Numeric(12, 2),
        "projeto": sa.String(length=120),
    }
    for column, column_type in processos_avulsos_column_types.items():
        op.alter_column("processos_avulsos", column, existing_type=column_type, nullable=True)

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_protocolo_tipo
            ON processos (protocolo, tipo);
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo
            ON processos (empresa_id, tipo, data_solicitacao)
         WHERE protocolo IS NULL;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_sem_protocolo_sem_data
            ON processos (empresa_id, tipo)
         WHERE protocolo IS NULL AND data_solicitacao IS NULL;
        """
    )

    op.execute("DROP INDEX IF EXISTS idx_proc_avulso_doc_tipo_data")
    op.execute("DROP INDEX IF EXISTS idx_proc_avulso_doc_tipo_sem_data")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_avulso_doc_tipo_data_null_protocolo
            ON processos_avulsos (documento, tipo, data_solicitacao)
         WHERE protocolo IS NULL;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_avulso_doc_tipo_null_protocolo_null_data
            ON processos_avulsos (documento, tipo)
         WHERE protocolo IS NULL AND data_solicitacao IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_proc_avulso_doc_tipo_null_protocolo_null_data")
    op.execute("DROP INDEX IF EXISTS uq_proc_avulso_doc_tipo_data_null_protocolo")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_proc_avulso_doc_tipo_data
            ON processos_avulsos (documento, tipo, data_solicitacao)
         WHERE data_solicitacao IS NOT NULL;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_proc_avulso_doc_tipo_sem_data
            ON processos_avulsos (documento, tipo)
         WHERE data_solicitacao IS NULL;
        """
    )

    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_sem_protocolo_sem_data")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_sem_protocolo_sem_data
            ON processos (empresa_id, tipo)
         WHERE protocolo IS NULL AND data_solicitacao IS NULL;
        """
    )
    op.execute("DROP INDEX IF EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_empresa_tipo_data_solicitacao_null_protocolo
            ON processos (empresa_id, tipo, data_solicitacao)
         WHERE protocolo IS NULL;
        """
    )
    op.execute("DROP INDEX IF EXISTS uq_proc_protocolo_tipo")

    op.execute(
        """
        UPDATE processos
           SET protocolo = ''
         WHERE protocolo IS NULL;
        """
    )
    op.execute(
        """
        UPDATE processos
           SET data_solicitacao = CURRENT_DATE
         WHERE data_solicitacao IS NULL;
        """
    )
    op.alter_column(
        "processos",
        "protocolo",
        existing_type=sa.String(length=120),
        nullable=False,
    )
    op.alter_column(
        "processos",
        "data_solicitacao",
        existing_type=sa.Date(),
        nullable=False,
    )
