"""Normalize empresas.cnpj and allow 11 (CPF) or 14 (CNPJ/CAEPF) digits."""
from __future__ import annotations

from alembic import op


revision = "20251028_01_empresas_doc_relax_and_normalize"
down_revision = "20251024_06_stg_processos_avulsos"  # ajuste para sua cadeia
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE empresas SET cnpj = regexp_replace(cnpj, '\\D', '', 'g');")
    op.execute("ALTER TABLE empresas DROP CONSTRAINT IF EXISTS ck_empresas_cnpj_digits;")
    op.execute("ALTER TABLE empresas DROP CONSTRAINT IF EXISTS ck_empresas_cnpj_len;")
    op.execute(
        """
        ALTER TABLE empresas
        ADD CONSTRAINT ck_empresas_cnpj_digits_len
        CHECK (cnpj ~ '^[0-9]{11}$' OR cnpj ~ '^[0-9]{14}$')
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE empresas DROP CONSTRAINT IF EXISTS ck_empresas_cnpj_digits_len;")
    op.execute(
        """
        ALTER TABLE empresas
        ADD CONSTRAINT ck_empresas_cnpj_len
        CHECK (cnpj ~ '^[0-9]{14}$')
        """
    )
