"""Add cnpj column to cnds

Revision ID: 20251212_02_cnds_add_cnpj
Revises: 20251212_01_certificados_view_titular_subject
Create Date: 2025-12-12 02:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251212_02_cnds_add_cnpj"
down_revision = "20251212_01_certificados_view_titular_subject"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cnds", sa.Column("cnpj", sa.String(length=14), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE cnds c
            SET cnpj = regexp_replace(e.cnpj, '\\D', '', 'g')
            FROM empresas e
            WHERE c.empresa_id = e.id
              AND c.org_id = e.org_id
              AND e.cnpj IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("cnds", "cnpj")
