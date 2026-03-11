"""add companies.fs_dirname and licence_file_events table

Revision ID: 20260306_0017
Revises: 20260304_0016
Create Date: 2026-03-06 10:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260306_0017"
down_revision: str | None = "20260304_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("fs_dirname", sa.String(length=255), nullable=True))

    op.create_table(
        "licence_file_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("hash", sa.String(length=64), nullable=False),
        sa.Column("detected_type", sa.String(length=64), nullable=True),
        sa.Column("detected_expiry", sa.Date(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="processed"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "company_id", "hash", name="uq_licence_file_events_org_company_hash"),
    )
    op.create_index("ix_licence_file_events_org_id", "licence_file_events", ["org_id"])
    op.create_index("ix_licence_file_events_company_id", "licence_file_events", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_licence_file_events_company_id", table_name="licence_file_events")
    op.drop_index("ix_licence_file_events_org_id", table_name="licence_file_events")
    op.drop_table("licence_file_events")
    op.drop_column("companies", "fs_dirname")

