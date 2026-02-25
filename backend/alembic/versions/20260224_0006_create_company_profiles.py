"""create company_profiles

Revision ID: 20260224_0006
Revises: 20260224_0005
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260224_0006"
down_revision = "20260224_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=True),
        sa.Column("porte", sa.String(length=32), nullable=True),
        sa.Column("status_empresa", sa.String(length=64), nullable=True),
        sa.Column("categoria", sa.String(length=128), nullable=True),
        sa.Column("inscricao_estadual", sa.String(length=64), nullable=True),
        sa.Column("inscricao_municipal", sa.String(length=64), nullable=True),
        sa.Column("situacao", sa.String(length=64), nullable=True),
        sa.Column("debito_prefeitura", sa.String(length=512), nullable=True),
        sa.Column("certificado_digital", sa.String(length=255), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("proprietario_principal", sa.String(length=255), nullable=True),
        sa.Column("cpf", sa.String(length=32), nullable=True),
        sa.Column("telefone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=512), nullable=True),
        sa.Column("responsavel_fiscal", sa.String(length=255), nullable=True),
        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "company_id", name="uq_company_profiles_org_company"),
    )
    op.create_index("ix_company_profiles_org_id", "company_profiles", ["org_id"], unique=False)
    op.create_index("ix_company_profiles_company_id", "company_profiles", ["company_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_company_profiles_company_id", table_name="company_profiles")
    op.drop_index("ix_company_profiles_org_id", table_name="company_profiles")
    op.drop_table("company_profiles")

