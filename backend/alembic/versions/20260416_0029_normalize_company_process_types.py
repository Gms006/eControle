"""normalize company_processes process_type aliases

Revision ID: 20260416_0029
Revises: 20260414_0028
Create Date: 2026-04-16 11:10:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260416_0029"
down_revision: str | None = "20260414_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_alias(alias: str, canonical: str) -> None:
    op.execute(
        sa.text(
            """
            UPDATE company_processes AS src
            SET process_type = :canonical
            WHERE src.process_type = :alias
              AND NOT EXISTS (
                  SELECT 1
                  FROM company_processes AS dst
                  WHERE dst.org_id = src.org_id
                    AND dst.company_id IS NOT DISTINCT FROM src.company_id
                    AND dst.protocolo = src.protocolo
                    AND dst.process_type = :canonical
                    AND dst.id <> src.id
              )
            """
        ).bindparams(alias=alias, canonical=canonical)
    )


def upgrade() -> None:
    _normalize_alias("USO_SOLO", "USO_DO_SOLO")
    _normalize_alias("CERTIDAO_USO_SOLO", "USO_DO_SOLO")
    _normalize_alias("CERTIDAO_DE_USO_DO_SOLO", "USO_DO_SOLO")
    _normalize_alias("AMBIENTAL", "LICENCA_AMBIENTAL")
    _normalize_alias("LICENCA_AMBIENTE", "LICENCA_AMBIENTAL")


def downgrade() -> None:
    # Irreversible data migration: canonical values do not preserve original aliases.
    pass
