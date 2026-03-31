"""normalize municipio as lowercase ascii

Revision ID: 20260327_0023
Revises: 20260325_0022
Create Date: 2026-03-27 11:40:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

from app.core.normalize import normalize_municipio


revision: str = "20260327_0023"
down_revision: str | None = "20260325_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_table_municipio(bind, table_name: str, id_column: str = "id") -> None:
    rows = bind.execute(
        sa.text(f"SELECT {id_column}, municipio FROM {table_name} WHERE municipio IS NOT NULL")
    ).fetchall()
    for row_id, municipio in rows:
        normalized = normalize_municipio(municipio)
        if normalized != municipio:
            bind.execute(
                sa.text(f"UPDATE {table_name} SET municipio = :municipio WHERE {id_column} = :row_id"),
                {"municipio": normalized, "row_id": row_id},
            )


def _add_lowercase_constraint(table_name: str, constraint_name: str) -> None:
    op.create_check_constraint(
        constraint_name=constraint_name,
        table_name=table_name,
        condition=sa.text("municipio IS NULL OR municipio = lower(municipio)"),
    )


def _drop_constraint_if_exists(bind, table_name: str, constraint_name: str) -> None:
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute(
            sa.text(
                f'ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS "{constraint_name}"'
            )
        )
        return
    op.drop_constraint(constraint_name, table_name=table_name, type_="check")


def upgrade() -> None:
    bind = op.get_bind()
    _normalize_table_municipio(bind, "companies", "id")
    _normalize_table_municipio(bind, "company_licences", "id")
    _normalize_table_municipio(bind, "company_processes", "id")
    _normalize_table_municipio(bind, "tax_portal_sync_runs", "id")

    _add_lowercase_constraint("companies", "ck_companies_municipio_lowercase")
    _add_lowercase_constraint("company_licences", "ck_company_licences_municipio_lowercase")
    _add_lowercase_constraint("company_processes", "ck_company_processes_municipio_lowercase")
    _add_lowercase_constraint("tax_portal_sync_runs", "ck_tax_portal_sync_runs_municipio_lowercase")


def downgrade() -> None:
    bind = op.get_bind()
    _drop_constraint_if_exists(bind, "tax_portal_sync_runs", "ck_tax_portal_sync_runs_municipio_lowercase")
    _drop_constraint_if_exists(bind, "company_processes", "ck_company_processes_municipio_lowercase")
    _drop_constraint_if_exists(bind, "company_licences", "ck_company_licences_municipio_lowercase")
    _drop_constraint_if_exists(bind, "companies", "ck_companies_municipio_lowercase")
