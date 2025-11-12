"""S3.1: certificados + agendamentos + view de status

Revision ID: 20251112_01_certificados_agend
Revises: be2b8ef49772
Create Date: 2025-11-12 10:40:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251112_01_certificados_agend"
down_revision = "be2b8ef49772"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "certificados",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id"), nullable=True),
        sa.Column("arquivo", sa.String(length=512), nullable=True),
        sa.Column("caminho", sa.String(length=1024), nullable=True),
        sa.Column("serial", sa.String(length=128), nullable=True),
        sa.Column("sha1", sa.String(length=128), nullable=True),
        sa.Column("subject", sa.String(length=1024), nullable=True),
        sa.Column("issuer", sa.String(length=1024), nullable=True),
        sa.Column("valido_de", sa.Date, nullable=True),
        sa.Column("valido_ate", sa.Date, nullable=True),
        sa.Column("senha", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("org_id", "serial", name="uq_certificados_org_serial"),
    )
    op.create_index("ix_certificados_org_id", "certificados", ["org_id"])
    op.create_index("ix_certificados_empresa_id", "certificados", ["empresa_id"])
    op.create_index("ix_certificados_valido_ate", "certificados", ["valido_ate"])

    op.create_table(
        "agendamentos",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id"), nullable=True),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("descricao", sa.Text, nullable=True),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tipo", sa.String(length=50), nullable=True),
        sa.Column("situacao", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agendamentos_org_id", "agendamentos", ["org_id"])
    op.create_index("ix_agendamentos_empresa_id", "agendamentos", ["empresa_id"])
    op.create_index("ix_agendamentos_inicio", "agendamentos", ["inicio"])

    op.execute(
        sa.text(
            """
        CREATE OR REPLACE VIEW v_certificados_status AS
        SELECT
            c.id                 AS cert_id,
            e.id                 AS empresa_id,
            e.org_id             AS org_id,
            e.empresa            AS empresa,
            e.cnpj               AS cnpj,
            c.valido_de,
            c.valido_ate,
            GREATEST(0, (c.valido_ate::date - current_date))::int AS dias_restantes,
            CASE
                WHEN c.valido_ate IS NULL THEN 'INDEFINIDO'
                WHEN c.valido_ate < current_date THEN 'VENCIDO'
                WHEN c.valido_ate <= current_date + INTERVAL '7 day' THEN 'VENCE EM 7 DIAS'
                WHEN c.valido_ate <= current_date + INTERVAL '30 day' THEN 'VENCE EM 30 DIAS'
                ELSE 'VÁLIDO'
            END AS situacao
        FROM certificados c
        LEFT JOIN empresas e
          ON e.id = c.empresa_id AND e.org_id = c.org_id
        WHERE current_setting('app.current_org', true) IS NULL
           OR e.org_id = current_setting('app.current_org')::uuid;
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS v_certificados_status"))
    op.drop_index("ix_agendamentos_inicio", table_name="agendamentos")
    op.drop_index("ix_agendamentos_empresa_id", table_name="agendamentos")
    op.drop_index("ix_agendamentos_org_id", table_name="agendamentos")
    op.drop_table("agendamentos")
    op.drop_index("ix_certificados_valido_ate", table_name="certificados")
    op.drop_index("ix_certificados_empresa_id", table_name="certificados")
    op.drop_index("ix_certificados_org_id", table_name="certificados")
    op.drop_table("certificados")
