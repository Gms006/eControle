from alembic import op
import sqlalchemy as sa

# revise/depends_on conforme seu cabeçalho
revision = "20251104_01_uq_users_org_email"
down_revision = "20251103_01_add_org_id_and_uniques"

def upgrade():
    op.create_unique_constraint(
        "uq_users_org_email",
        "users",
        ["org_id", "email"],
    )

def downgrade():
    op.drop_constraint("uq_users_org_email", "users", type_="unique")
