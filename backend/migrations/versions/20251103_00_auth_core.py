"""Auth core: orgs + users, seed default org and master user.

Revision ID: 20251103_00_auth_core
Revises: 20251030_02_processos_protocolo_nullable
Create Date: 2025-11-03 09:40:00-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import os

# revision identifiers
revision = "20251103_00_auth_core"
down_revision = "20251030_02_processos_protocolo_nullable"
branch_labels = None
depends_on = None

DEFAULT_ORG_ID = os.getenv("ORG_ID", "00000000-0000-0000-0000-000000000001")
DEFAULT_ORG_NAME = os.getenv("ORG_NAME", "Neto Contabilidade")
MASTER_EMAIL = os.getenv("MASTER_USER_EMAIL", "cadastro@netocontabilidade.com.br")
MASTER_NAME = os.getenv("MASTER_USER_NAME", "Maria Clara")


def upgrade():
    # orgs
    op.create_table(
        "orgs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("uq_orgs_name", "orgs", ["name"], unique=True)

    # users
    role_enum = postgresql.ENUM("OWNER", "ADMIN", "STAFF", "VIEWER", name="user_role_enum", create_type=False)
    role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("role", role_enum, nullable=False, server_default="OWNER"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("uq_users_org_email", "users", ["org_id", "email"], unique=True)

    # seeds idempotentes
    op.execute(f"""
    INSERT INTO orgs (id, name)
    VALUES ('{DEFAULT_ORG_ID}'::uuid, '{DEFAULT_ORG_NAME}')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    """)

    op.execute(f"""
    INSERT INTO users (org_id, email, name, role, is_active)
    VALUES ('{DEFAULT_ORG_ID}'::uuid, '{MASTER_EMAIL}', '{MASTER_NAME}', 'OWNER', TRUE)
    ON CONFLICT (org_id, email) DO UPDATE
      SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
    """)


def downgrade():
    op.drop_index("uq_users_org_email", table_name="users")
    op.drop_table("users")
    op.drop_index("uq_orgs_name", table_name="orgs")
    op.drop_table("orgs")
    try:
        role_enum = postgresql.ENUM("OWNER", "ADMIN", "STAFF", "VIEWER", name="user_role_enum")
        role_enum.drop(op.get_bind(), checkfirst=True)
    except Exception:
        pass
