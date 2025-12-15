"""merge heads

Revision ID: 20251216_00_merge_heads
Revises: ('20251029_02_proc_avulsos_protocolo_partial', '20251030_03_add_taxas_vencimento_tpi', '20251104_01_licencas_table_fix_and_update', '20251106_02_s3_perf_indexes', '20251214_00_processos_obs_history')
Create Date: 2025-12-15 20:02:40.214882
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251216_00_merge_heads"
down_revision = ('20251029_02_proc_avulsos_protocolo_partial', '20251030_03_add_taxas_vencimento_tpi', '20251104_01_licencas_table_fix_and_update', '20251106_02_s3_perf_indexes', '20251214_00_processos_obs_history')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
