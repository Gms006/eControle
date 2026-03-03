"""refine municipio normalization preserving accents

Revision ID: 20260227_0013
Revises: 20260227_0012
Create Date: 2026-02-27 15:20:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

from app.core.normalize import normalize_municipio


# revision identifiers, used by Alembic.
revision: str = "20260227_0013"
down_revision: str | None = "20260227_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_table_municipio(bind, table_name: str, id_column: str = "id") -> None:
    rows = bind.execute(
        sa.text(f"SELECT {id_column}, municipio FROM {table_name} WHERE municipio IS NOT NULL")
    ).fetchall()
    for row_id, municipio in rows:
        normalized = normalize_municipio(municipio)
        if normalized and normalized != municipio:
            bind.execute(
                sa.text(f"UPDATE {table_name} SET municipio = :municipio WHERE {id_column} = :row_id"),
                {"municipio": normalized, "row_id": row_id},
            )


def upgrade() -> None:
    bind = op.get_bind()
    _normalize_table_municipio(bind, "companies", "id")
    _normalize_table_municipio(bind, "company_licences", "id")
    _normalize_table_municipio(bind, "company_processes", "id")


def downgrade() -> None:
    # data normalization is intentionally irreversible
    return None
