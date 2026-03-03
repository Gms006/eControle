"""normalize process situacao to canonical snake_case

Revision ID: 20260227_0011
Revises: 20260227_0010
Create Date: 2026-02-27 13:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

from app.core.normalize import normalize_process_situacao

# revision identifiers, used by Alembic.
revision: str = "20260227_0011"
down_revision: str | None = "20260227_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_process_table(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, situacao FROM company_processes")).fetchall()
    for row_id, situacao in rows:
        normalized = normalize_process_situacao(situacao, strict=False)
        if normalized == situacao:
            continue
        bind.execute(
            sa.text("UPDATE company_processes SET situacao = :situacao WHERE id = :id"),
            {"id": row_id, "situacao": normalized},
        )


def upgrade() -> None:
    bind = op.get_bind()
    _normalize_process_table(bind)


def downgrade() -> None:
    # data normalization is intentionally irreversible
    return None
