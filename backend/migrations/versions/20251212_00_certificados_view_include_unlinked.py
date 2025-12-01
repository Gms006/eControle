"""Include certificados without empresa in status view

Revision ID: 20251212_00_certificados_view_include_unlinked
Revises: 20251128_01_certificate_keys
Create Date: 2025-12-12 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251212_00_certificados_view_include_unlinked"
down_revision = "20251128_01_certificate_keys"
branch_labels = None
depends_on = None

VIEW_SQL = """
DROP VIEW IF EXISTS v_certificados_status;

CREATE VIEW v_certificados_status AS
SELECT
    c.id AS cert_id,
    c.empresa_id,
    COALESCE(e.org_id, c.org_id) AS org_id,
    e.empresa,
    e.cnpj,
    c.valido_de,
    c.valido_ate,
    c.senha,
    GREATEST(0, (c.valido_ate - CURRENT_DATE)) AS dias_restantes,
    CASE
        WHEN c.valido_ate IS NULL THEN 'INDEFINIDO'
        WHEN c.valido_ate < CURRENT_DATE THEN 'VENCIDO'
        WHEN c.valido_ate <= CURRENT_DATE + INTERVAL '7 days' THEN 'VENCE EM 7 DIAS'
        WHEN c.valido_ate <= CURRENT_DATE + INTERVAL '30 days' THEN 'VENCE EM 30 DIAS'
        ELSE 'VÁLIDO'
    END AS situacao
FROM public.certificados c
LEFT JOIN public.empresas e ON (e.id = c.empresa_id AND e.org_id = c.org_id)
WHERE current_setting('app.current_org', true) IS NULL
    OR COALESCE(e.org_id, c.org_id) = current_setting('app.current_org')::uuid;
"""

def upgrade() -> None:
    op.execute(sa.text(VIEW_SQL))


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS v_certificados_status"))
