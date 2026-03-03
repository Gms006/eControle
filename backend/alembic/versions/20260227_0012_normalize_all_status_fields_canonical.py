"""normalize status fields to canonical snake_case

Revision ID: 20260227_0012
Revises: 20260227_0011
Create Date: 2026-02-27 15:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

from app.core.normalize import normalize_generic_status, normalize_process_situacao


# revision identifiers, used by Alembic.
revision: str = "20260227_0012"
down_revision: str | None = "20260227_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_columns(bind, table_name: str, columns: list[str], *, process_status: bool = False) -> None:
    select_columns = ", ".join(["id", *columns])
    rows = bind.execute(sa.text(f"SELECT {select_columns} FROM {table_name}")).fetchall()
    for row in rows:
        row_id = row[0]
        values = row[1:]
        updates: dict[str, str | None] = {}
        for idx, column in enumerate(columns):
            current = values[idx]
            normalized = (
                normalize_process_situacao(current, strict=False)
                if process_status
                else normalize_generic_status(current, strict=False)
            )
            if normalized != current:
                updates[column] = normalized
        if not updates:
            continue
        assignments = ", ".join([f"{column} = :{column}" for column in updates.keys()])
        bind.execute(
            sa.text(f"UPDATE {table_name} SET {assignments} WHERE id = :id"),
            {"id": row_id, **updates},
        )


def upgrade() -> None:
    bind = op.get_bind()
    _normalize_columns(
        bind,
        "company_taxes",
        [
            "taxa_funcionamento",
            "taxa_publicidade",
            "taxa_vig_sanitaria",
            "iss",
            "taxa_localiz_instalacao",
            "taxa_ocup_area_publica",
            "taxa_bombeiros",
            "tpi",
            "status_taxas",
        ],
    )
    _normalize_columns(
        bind,
        "company_licences",
        [
            "alvara_vig_sanitaria",
            "cercon",
            "alvara_funcionamento",
            "licenca_ambiental",
            "certidao_uso_solo",
        ],
    )
    _normalize_columns(bind, "company_profiles", ["situacao", "status_empresa"])
    _normalize_columns(bind, "company_processes", ["situacao"], process_status=True)


def downgrade() -> None:
    # data normalization is intentionally irreversible
    return None
