"""add regulatory domain fields

Revision ID: 20260423_0030
Revises: 20260416_0029
Create Date: 2026-04-23 09:30:00.000000
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260423_0030"
down_revision = "20260416_0029"
branch_labels = None
depends_on = None


DEFAULT_ALVARA_KIND = "PENDENTE_REVISAO"
DEFAULT_SANITARY_COMPLEXITY = "PENDENTE_REVISAO"
DEFAULT_ADDRESS_USAGE_TYPE = "PENDENTE_REVISAO"
DEFAULT_ADDRESS_LOCATION_TYPE = "PENDENTE_REVISAO"


def _decode_raw(value) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            loaded = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return loaded if isinstance(loaded, dict) else {}
    return {}


def _infer_alvara_kind(raw: dict) -> str:
    document_kind = str(raw.get("source_document_kind_alvara_funcionamento") or "").strip().upper()
    source_kind = str(raw.get("source_kind_alvara_funcionamento") or "").strip().lower()

    if document_kind == "ALVARA_FUNCIONAMENTO_DEFINITIVO":
        return "DEFINITIVO"
    if document_kind == "ALVARA_FUNCIONAMENTO_CONDICIONADO":
        return "CONDICIONADO"
    if document_kind == "ALVARA_FUNCIONAMENTO_PROVISORIO":
        return "PROVISORIO"
    if source_kind == "definitivo":
        return "DEFINITIVO"
    return DEFAULT_ALVARA_KIND


def backfill_company_licences(connection) -> None:
    rows = connection.execute(sa.text("SELECT id, raw FROM company_licences")).mappings().all()
    for row in rows:
        raw = _decode_raw(row.get("raw"))
        connection.execute(
            sa.text(
                """
                UPDATE company_licences
                SET alvara_funcionamento_kind = :kind
                WHERE id = :id
                """
            ),
            {"id": row["id"], "kind": _infer_alvara_kind(raw)},
        )


def backfill_company_profiles(connection) -> None:
    rows = connection.execute(sa.text("SELECT id, raw FROM company_profiles")).mappings().all()
    for row in rows:
        raw = _decode_raw(row.get("raw"))
        address_usage_type = "FISCAL" if raw.get("endereco_fiscal") is True else DEFAULT_ADDRESS_USAGE_TYPE
        connection.execute(
            sa.text(
                """
                UPDATE company_profiles
                SET sanitary_complexity = :sanitary_complexity,
                    address_usage_type = :address_usage_type,
                    address_location_type = :address_location_type
                WHERE id = :id
                """
            ),
            {
                "id": row["id"],
                "sanitary_complexity": DEFAULT_SANITARY_COMPLEXITY,
                "address_usage_type": address_usage_type,
                "address_location_type": DEFAULT_ADDRESS_LOCATION_TYPE,
            },
        )


def upgrade() -> None:
    op.add_column(
        "company_licences",
        sa.Column(
            "alvara_funcionamento_kind",
            sa.String(length=32),
            nullable=False,
            server_default=DEFAULT_ALVARA_KIND,
        ),
    )
    op.add_column(
        "company_profiles",
        sa.Column(
            "sanitary_complexity",
            sa.String(length=32),
            nullable=False,
            server_default=DEFAULT_SANITARY_COMPLEXITY,
        ),
    )
    op.add_column(
        "company_profiles",
        sa.Column(
            "address_usage_type",
            sa.String(length=32),
            nullable=False,
            server_default=DEFAULT_ADDRESS_USAGE_TYPE,
        ),
    )
    op.add_column(
        "company_profiles",
        sa.Column(
            "address_location_type",
            sa.String(length=32),
            nullable=False,
            server_default=DEFAULT_ADDRESS_LOCATION_TYPE,
        ),
    )

    connection = op.get_bind()
    backfill_company_licences(connection)
    backfill_company_profiles(connection)

    op.alter_column("company_licences", "alvara_funcionamento_kind", server_default=None)
    op.alter_column("company_profiles", "sanitary_complexity", server_default=None)
    op.alter_column("company_profiles", "address_usage_type", server_default=None)
    op.alter_column("company_profiles", "address_location_type", server_default=None)


def downgrade() -> None:
    op.drop_column("company_profiles", "address_location_type")
    op.drop_column("company_profiles", "address_usage_type")
    op.drop_column("company_profiles", "sanitary_complexity")
    op.drop_column("company_licences", "alvara_funcionamento_kind")
