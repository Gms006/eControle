"""create dashboard saved views table

Revision ID: 20260414_0028
Revises: 20260402_0027
Create Date: 2026-04-14 10:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260414_0028"
down_revision: str | None = "20260402_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dashboard_saved_views",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("tab_key", sa.String(length=32), server_default=sa.text("'painel'"), nullable=False),
        sa.Column("scope", sa.String(length=16), server_default=sa.text("'personal'"), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_saved_views_org_tab", "dashboard_saved_views", ["org_id", "tab_key"], unique=False)
    op.create_index("ix_dashboard_saved_views_org_scope", "dashboard_saved_views", ["org_id", "scope"], unique=False)
    op.create_index("ix_dashboard_saved_views_org_user", "dashboard_saved_views", ["org_id", "created_by_user_id"], unique=False)
    op.create_index("ix_dashboard_saved_views_org_pinned", "dashboard_saved_views", ["org_id", "is_pinned"], unique=False)
    op.create_index("ix_dashboard_saved_views_org_id", "dashboard_saved_views", ["org_id"], unique=False)
    op.create_index("ix_dashboard_saved_views_created_by_user_id", "dashboard_saved_views", ["created_by_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_dashboard_saved_views_created_by_user_id", table_name="dashboard_saved_views")
    op.drop_index("ix_dashboard_saved_views_org_id", table_name="dashboard_saved_views")
    op.drop_index("ix_dashboard_saved_views_org_pinned", table_name="dashboard_saved_views")
    op.drop_index("ix_dashboard_saved_views_org_user", table_name="dashboard_saved_views")
    op.drop_index("ix_dashboard_saved_views_org_scope", table_name="dashboard_saved_views")
    op.drop_index("ix_dashboard_saved_views_org_tab", table_name="dashboard_saved_views")
    op.drop_table("dashboard_saved_views")
