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
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                -- Try to add the column; ignore if it already exists or if privileges are insufficient.
                BEGIN
                    ALTER TABLE public.cnds ADD COLUMN cnpj VARCHAR(14);
                EXCEPTION
                    WHEN duplicate_column THEN
                        NULL;
                    WHEN insufficient_privilege THEN
                        RAISE NOTICE 'Skipping cnds.cnpj add: insufficient privilege';
                END;

                -- Try to backfill using empresas.cnpj when possible.
                BEGIN
                    UPDATE cnds c
                    SET cnpj = regexp_replace(e.cnpj, '\\D', '', 'g')
                    FROM empresas e
                    WHERE c.empresa_id = e.id
                      AND c.org_id = e.org_id
                      AND e.cnpj IS NOT NULL
                      AND c.cnpj IS NULL;
                EXCEPTION
                    WHEN undefined_column THEN
                        NULL;
                    WHEN insufficient_privilege THEN
                        RAISE NOTICE 'Skipping cnds.cnpj backfill: insufficient privilege';
                END;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                BEGIN
                    ALTER TABLE public.cnds DROP COLUMN cnpj;
                EXCEPTION
                    WHEN undefined_column THEN
                        NULL;
                    WHEN insufficient_privilege THEN
                        RAISE NOTICE 'Skipping cnds.cnpj drop: insufficient privilege';
                END;
            END $$;
            """
        )
    )
