"""Use subject as fallback for titular/cnpj in certificados view

Revision ID: 20251212_01_certificados_view_titular_subject
Revises: 20251212_00_certificados_view_include_unlinked
Create Date: 2025-12-12 01:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251212_01_certificados_view_titular_subject"
down_revision = "20251212_00_certificados_view_include_unlinked"
branch_labels = None
depends_on = None

VIEW_SQL = """
DROP VIEW IF EXISTS v_certificados_status;

CREATE VIEW v_certificados_status AS
WITH base AS (
    SELECT
        c.id          AS cert_id,
        c.empresa_id,
        c.org_id      AS org_id_cert,
        c.subject,
        c.valido_de,
        c.valido_ate,
        c.senha,
        e.org_id      AS org_id_emp,
        e.empresa     AS empresa_db,
        e.cnpj        AS cnpj_db,
        -- trecho CN=... (antes da primeira vírgula)
        regexp_replace(c.subject, '^CN=([^,]+).*$','\\1') AS cn_raw
    FROM public.certificados c
    LEFT JOIN public.empresas e
      ON e.id = c.empresa_id
     AND e.org_id = c.org_id
)
SELECT
    cert_id,
    empresa_id,
    -- org_id: da empresa se existir, senão do certificado
    COALESCE(org_id_emp, org_id_cert) AS org_id,

    -- Titular / "Empresa" exibida no front:
    -- 1) se tiver empresa ligada, usa e.empresa
    -- 2) senão, usa a parte antes do ":" do CN
    -- 3) se ainda assim ficar vazio, cai pro subject inteiro
    COALESCE(
        empresa_db,
        NULLIF(split_part(cn_raw, ':', 1), ''),
        NULLIF(subject, '')
    ) AS empresa,

    -- CPF/CNPJ:
    -- 1) se tiver empresa ligada, usa e.cnpj
    -- 2) senão, pega a parte depois do ":" do CN e deixa só dígitos
    COALESCE(
        cnpj_db,
        NULLIF(regexp_replace(split_part(cn_raw, ':', 2), '\\D', '', 'g'), '')
    ) AS cnpj,

    valido_de,
    valido_ate,
    senha,
    GREATEST(0, (valido_ate - CURRENT_DATE)) AS dias_restantes,
    CASE
        WHEN valido_ate IS NULL THEN 'INDEFINIDO'
        WHEN valido_ate < CURRENT_DATE THEN 'VENCIDO'
        WHEN valido_ate <= CURRENT_DATE + INTERVAL '7 days'  THEN 'VENCE EM 7 DIAS'
        WHEN valido_ate <= CURRENT_DATE + INTERVAL '30 days' THEN 'VENCE EM 30 DIAS'
        ELSE 'VÁLIDO'
    END AS situacao
FROM base
WHERE current_setting('app.current_org', true) IS NULL
   OR COALESCE(org_id_emp, org_id_cert) = current_setting('app.current_org')::uuid;
"""

def upgrade() -> None:
    op.execute(sa.text(VIEW_SQL))


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS v_certificados_status"))
