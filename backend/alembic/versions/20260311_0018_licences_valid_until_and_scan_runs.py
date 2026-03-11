"""add valid_until dates to licences, normalize legacy status, and create licence_scan_runs

Revision ID: 20260311_0018
Revises: 20260306_0017
Create Date: 2026-03-11 10:00:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
import json
import re

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260311_0018"
down_revision: str | None = "20260306_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LICENCE_FIELDS = [
    "cercon",
    "alvara_vig_sanitaria",
    "alvara_funcionamento",
    "certidao_uso_solo",
    "licenca_ambiental",
]

LEGACY_STATUS_WITH_DATE_RE = re.compile(r"^(?P<base>[a-z_]+?)_val_(?P<d>\d{2})_(?P<m>\d{2})_(?P<y>\d{4})$")


def _raw_to_dict(raw_value) -> dict:
    if isinstance(raw_value, dict):
        return dict(raw_value)
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, dict):
                return dict(parsed)
        except Exception:
            return {}
    return {}


def _parse_iso_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(str(value or "").strip())
    except Exception:
        return None


def _legacy_status_to_parts(value: str | None) -> tuple[str | None, date | None]:
    text = str(value or "").strip().lower()
    if not text:
        return None, None
    if text == "possui_definitiva":
        return "definitivo", None

    match = LEGACY_STATUS_WITH_DATE_RE.match(text)
    if not match:
        return text, None
    day = int(match.group("d"))
    month = int(match.group("m"))
    year = int(match.group("y"))
    try:
        parsed_date = date(year, month, day)
    except ValueError:
        parsed_date = None

    base = match.group("base")
    if base == "possui":
        return "possui", parsed_date
    if base == "vencido":
        return "vencido", parsed_date
    if base == "dispensa":
        return "possui", parsed_date
    return base, parsed_date


def _dispensa_document_kind_for_field(field: str) -> str:
    if field == "alvara_vig_sanitaria":
        return "DISPENSA_SANITARIA"
    if field == "licenca_ambiental":
        return "DISPENSA_AMBIENTAL"
    return "DISPENSA"


def backfill_company_licences(bind) -> None:
    company_licences_table = sa.table(
        "company_licences",
        sa.column("id", sa.String()),
        sa.column("raw", sa.JSON()),
    )
    select_columns = ", ".join(["id", "raw", *LICENCE_FIELDS])
    rows = bind.execute(sa.text(f"SELECT {select_columns} FROM company_licences")).fetchall()
    for row in rows:
        row_id = row[0]
        raw = _raw_to_dict(row[1])
        updates: dict[str, object] = {}

        for idx, field in enumerate(LICENCE_FIELDS):
            status_value = row[2 + idx]
            valid_until_column = f"{field}_valid_until"
            validity_raw_key = f"validade_{field}"

            valid_until = _parse_iso_date(raw.get(validity_raw_key))
            normalized_status, fallback_date = _legacy_status_to_parts(status_value)
            if valid_until is None:
                valid_until = fallback_date

            if valid_until is not None:
                updates[valid_until_column] = valid_until

            if normalized_status and normalized_status != status_value:
                updates[field] = normalized_status

            if str(status_value or "").strip().lower().startswith("dispensa_val_"):
                raw[f"source_document_kind_{field}"] = _dispensa_document_kind_for_field(field)

        if updates:
            assignments = ", ".join([f"{column} = :{column}" for column in updates.keys()])
            bind.execute(
                sa.text(f"UPDATE company_licences SET {assignments} WHERE id = :id"),
                {"id": row_id, **updates},
            )

        if raw != _raw_to_dict(row[1]):
            bind.execute(
                company_licences_table.update()
                .where(company_licences_table.c.id == row_id)
                .values(raw=raw)
            )


def upgrade() -> None:
    for field in LICENCE_FIELDS:
        op.add_column("company_licences", sa.Column(f"{field}_valid_until", sa.Date(), nullable=True))

    op.create_table(
        "licence_scan_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ok_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=800), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_licence_scan_runs_org_id", "licence_scan_runs", ["org_id"])
    op.create_index("ix_licence_scan_runs_status", "licence_scan_runs", ["status"])

    backfill_company_licences(op.get_bind())


def downgrade() -> None:
    op.drop_index("ix_licence_scan_runs_status", table_name="licence_scan_runs")
    op.drop_index("ix_licence_scan_runs_org_id", table_name="licence_scan_runs")
    op.drop_table("licence_scan_runs")

    for field in reversed(LICENCE_FIELDS):
        op.drop_column("company_licences", f"{field}_valid_until")
