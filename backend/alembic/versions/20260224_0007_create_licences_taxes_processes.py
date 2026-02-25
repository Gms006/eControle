"""create company_licences, company_taxes, company_processes

Revision ID: 20260224_0007
Revises: 20260224_0006
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260224_0007"
down_revision = "20260224_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------
    # company_licences (1:1)
    # -----------------------------
    op.create_table(
        "company_licences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("municipio", sa.String(length=128), nullable=True),

        sa.Column("alvara_vig_sanitaria", sa.String(length=64), nullable=True),
        sa.Column("cercon", sa.String(length=64), nullable=True),
        sa.Column("alvara_funcionamento", sa.String(length=64), nullable=True),
        sa.Column("licenca_ambiental", sa.String(length=64), nullable=True),
        sa.Column("certidao_uso_solo", sa.String(length=64), nullable=True),

        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "company_id", name="uq_company_licences_org_company"),
    )
    op.create_index("ix_company_licences_org_id", "company_licences", ["org_id"], unique=False)
    op.create_index("ix_company_licences_company_id", "company_licences", ["company_id"], unique=False)

    # -----------------------------
    # company_taxes (1:1)
    # -----------------------------
    op.create_table(
        "company_taxes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),

        # Campos semiestruturados (vêm com observações / "Em aberto desde 2020", etc.)
        sa.Column("data_envio", sa.String(length=128), nullable=True),
        sa.Column("taxa_funcionamento", sa.String(length=128), nullable=True),
        sa.Column("taxa_publicidade", sa.String(length=128), nullable=True),
        sa.Column("taxa_vig_sanitaria", sa.String(length=128), nullable=True),
        sa.Column("iss", sa.String(length=128), nullable=True),
        sa.Column("taxa_localiz_instalacao", sa.String(length=128), nullable=True),
        sa.Column("taxa_ocup_area_publica", sa.String(length=128), nullable=True),
        sa.Column("taxa_bombeiros", sa.String(length=128), nullable=True),
        sa.Column("tpi", sa.String(length=128), nullable=True),
        sa.Column("vencimento_tpi", sa.String(length=128), nullable=True),
        sa.Column("status_taxas", sa.String(length=64), nullable=True),

        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "company_id", name="uq_company_taxes_org_company"),
    )
    op.create_index("ix_company_taxes_org_id", "company_taxes", ["org_id"], unique=False)
    op.create_index("ix_company_taxes_company_id", "company_taxes", ["company_id"], unique=False)

    # -----------------------------
    # company_processes (N:1)
    # Uma tabela só, com process_type + extra JSON
    # -----------------------------
    op.create_table(
        "company_processes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),

        # chave natural do processo
        sa.Column("process_type", sa.String(length=64), nullable=False),  # DIVERSOS / CERCON / USO_SOLO / ...
        sa.Column("protocolo", sa.String(length=128), nullable=False),

        # campos comuns (nem todos são obrigatórios)
        sa.Column("municipio", sa.String(length=128), nullable=True),
        sa.Column("orgao", sa.String(length=128), nullable=True),
        sa.Column("operacao", sa.String(length=255), nullable=True),
        sa.Column("data_solicitacao", sa.String(length=64), nullable=True),
        sa.Column("situacao", sa.String(length=64), nullable=True),
        sa.Column("obs", sa.Text(), nullable=True),

        # Extra por subtipo (CERCON/USO_SOLO/SANITARIO/etc.)
        sa.Column("extra", sa.JSON(), nullable=True),
        sa.Column("raw", sa.JSON(), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "company_id", "process_type", "protocolo", name="uq_company_processes_natkey"),
    )
    op.create_index("ix_company_processes_org_id", "company_processes", ["org_id"], unique=False)
    op.create_index("ix_company_processes_company_id", "company_processes", ["company_id"], unique=False)
    op.create_index("ix_company_processes_type", "company_processes", ["process_type"], unique=False)
    op.create_index("ix_company_processes_protocolo", "company_processes", ["protocolo"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_company_processes_protocolo", table_name="company_processes")
    op.drop_index("ix_company_processes_type", table_name="company_processes")
    op.drop_index("ix_company_processes_company_id", table_name="company_processes")
    op.drop_index("ix_company_processes_org_id", table_name="company_processes")
    op.drop_table("company_processes")

    op.drop_index("ix_company_taxes_company_id", table_name="company_taxes")
    op.drop_index("ix_company_taxes_org_id", table_name="company_taxes")
    op.drop_table("company_taxes")

    op.drop_index("ix_company_licences_company_id", table_name="company_licences")
    op.drop_index("ix_company_licences_org_id", table_name="company_licences")
    op.drop_table("company_licences")

