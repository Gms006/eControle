"""S3 performance indexes

Revision ID: 20251106_02_s3_perf_indexes
Revises: 20251106_01_s3_api_views_org_audit
Create Date: 2025-11-06 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20251106_02_s3_perf_indexes"
down_revision = "20251106_01_s3_api_views_org_audit"
branch_labels = None
depends_on = None


INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_empresas_org_municipio ON empresas (org_id, municipio)",
    "CREATE INDEX IF NOT EXISTS idx_licencas_org_status_validade ON licencas (org_id, status, validade)",
    "CREATE INDEX IF NOT EXISTS idx_taxas_org_status_data_envio ON taxas (org_id, status, data_envio)",
    "CREATE INDEX IF NOT EXISTS idx_taxas_org_vencimento_tpi ON taxas (org_id, vencimento_tpi)",
    "CREATE INDEX IF NOT EXISTS idx_processos_org_situacao_prazo ON processos (org_id, situacao, prazo)",
)

DROP_INDEXES = (
    "DROP INDEX IF EXISTS idx_processos_org_situacao_prazo",
    "DROP INDEX IF EXISTS idx_taxas_org_vencimento_tpi",
    "DROP INDEX IF EXISTS idx_taxas_org_status_data_envio",
    "DROP INDEX IF EXISTS idx_licencas_org_status_validade",
    "DROP INDEX IF EXISTS idx_empresas_org_municipio",
)


def upgrade() -> None:
    for statement in INDEXES:
        op.execute(statement)


def downgrade() -> None:
    for statement in DROP_INDEXES:
        op.execute(statement)
