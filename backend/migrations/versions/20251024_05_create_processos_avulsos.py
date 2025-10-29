"""Create processos_avulsos table for orphan processes."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20251024_05_create_processos_avulsos"
down_revision = "20251024_04_uq_proc_sem_protocolo_sem_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    situacao_enum = postgresql.ENUM(name="situacao_processo_enum", create_type=False)
    operacao_enum = postgresql.ENUM(name="operacao_diversos_enum", create_type=False)
    orgao_enum = postgresql.ENUM(name="orgao_diversos_enum", create_type=False)
    alvara_enum = postgresql.ENUM(name="alvara_funcionamento_enum", create_type=False)
    servico_enum = postgresql.ENUM(name="servico_sanitario_enum", create_type=False)
    notificacao_enum = postgresql.ENUM(name="notificacao_sanitaria_enum", create_type=False)

    op.create_table(
        "processos_avulsos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("documento", sa.String(length=30), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("protocolo", sa.String(length=120), nullable=True),
        sa.Column("data_solicitacao", sa.Date, nullable=True),
        sa.Column("situacao", situacao_enum, nullable=False),
        sa.Column("status_padrao", sa.String(length=120), nullable=True),
        sa.Column("obs", sa.Text, nullable=True),
        sa.Column("operacao", operacao_enum, nullable=True),
        sa.Column("orgao", orgao_enum, nullable=True),
        sa.Column("alvara", alvara_enum, nullable=True),
        sa.Column("municipio", sa.String(length=120), nullable=True),
        sa.Column("tpi", sa.String(length=120), nullable=True),
        sa.Column("inscricao_imobiliaria", sa.String(length=120), nullable=True),
        sa.Column("servico", servico_enum, nullable=True),
        sa.Column("taxa", sa.String(length=120), nullable=True),
        sa.Column("notificacao", notificacao_enum, nullable=True),
        sa.Column("data_val", sa.Date, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
        ),
        sa.UniqueConstraint("protocolo", "tipo", name="uq_proc_avulso_protocolo_tipo"),
    )

    op.create_index(
        "idx_proc_avulso_doc_tipo_data",
        "processos_avulsos",
        ["documento", "tipo", "data_solicitacao"],
        unique=True,
        postgresql_where=sa.text("data_solicitacao IS NOT NULL"),
    )
    op.create_index(
        "idx_proc_avulso_doc_tipo_sem_data",
        "processos_avulsos",
        ["documento", "tipo"],
        unique=True,
        postgresql_where=sa.text("data_solicitacao IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_proc_avulso_doc_tipo_sem_data", table_name="processos_avulsos")
    op.drop_index("idx_proc_avulso_doc_tipo_data", table_name="processos_avulsos")
    op.drop_table("processos_avulsos")
