"""Add column vencimento_tpi (DATE) to taxas"""
from alembic import op
import sqlalchemy as sa

# revisões
revision = "20251030_03_add_taxas_vencimento_tpi"
down_revision = "20251030_03_processos_datasolicitacao_nullable"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("taxas")}

    if "vencimento_tpi" not in columns:
        with op.batch_alter_table("taxas") as batch_op:
            batch_op.add_column(sa.Column("vencimento_tpi", sa.Date(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("taxas")}

    if "vencimento_tpi" in columns:
        with op.batch_alter_table("taxas") as batch_op:
            batch_op.drop_column("vencimento_tpi")
