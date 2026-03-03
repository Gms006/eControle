"""normalize municipios existing data

Revision ID: 20260227_0010
Revises: 20260227_0009
Create Date: 2026-02-27
"""

from __future__ import annotations

import re
import unicodedata

from alembic import op
import sqlalchemy as sa


revision = "20260227_0010"
down_revision = "20260227_0009"
branch_labels = None
depends_on = None


GO_EXCEPTIONS = {
    "ANAPOLIS": "ANÁPOLIS",
    "GOIANIA": "GOIÂNIA",
    "APARECIDA DE GOIANIA": "APARECIDA DE GOIÂNIA",
    "TRINDADE": "TRINDADE",
    "SENADOR CANEDO": "SENADOR CANEDO",
}


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize_municipio(value: str | None) -> str | None:
    text = " ".join(str(value or "").strip().split())
    if not text:
        return None
    key = re.sub(r"\s+", " ", _strip_accents(text).upper()).strip()
    return GO_EXCEPTIONS.get(key, key)


def _normalize_table_municipio(table_name: str, id_column: str = "id") -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(f"SELECT {id_column}, municipio FROM {table_name} WHERE municipio IS NOT NULL")).fetchall()
    for row_id, municipio in rows:
        normalized = _normalize_municipio(municipio)
        if normalized and normalized != municipio:
            bind.execute(
                sa.text(f"UPDATE {table_name} SET municipio = :municipio WHERE {id_column} = :row_id"),
                {"municipio": normalized, "row_id": row_id},
            )


def upgrade() -> None:
    _normalize_table_municipio("companies", "id")
    _normalize_table_municipio("company_licences", "id")
    _normalize_table_municipio("company_processes", "id")


def downgrade() -> None:
    # No-op: normalization is intentionally irreversible.
    pass

