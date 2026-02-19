"""add org slug and updated_at

Revision ID: 20260218_0003
Revises: 20260218_0002
Create Date: 2026-02-18 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260218_0003"
down_revision: Union[str, None] = "20260218_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(value: str) -> str:
    slug = []
    last_was_dash = False
    for char in value.strip().lower():
        if char.isalnum():
            slug.append(char)
            last_was_dash = False
        else:
            if not last_was_dash:
                slug.append("-")
                last_was_dash = True
    text = "".join(slug).strip("-")
    return text or "org"


def upgrade() -> None:
    op.add_column("orgs", sa.Column("slug", sa.String(length=64), nullable=True))
    op.add_column(
        "orgs",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    connection = op.get_bind()
    result = connection.execute(sa.text("select id, name from orgs"))
    existing = set()
    for row in result:
        base_slug = _slugify(row.name)
        slug = base_slug
        counter = 2
        while slug in existing:
            slug = f"{base_slug}-{counter}"
            counter += 1
        existing.add(slug)
        connection.execute(
            sa.text("update orgs set slug = :slug where id = :org_id"),
            {"slug": slug, "org_id": row.id},
        )

    op.create_index("ux_orgs_slug", "orgs", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_orgs_slug", table_name="orgs")
    op.drop_column("orgs", "updated_at")
    op.drop_column("orgs", "slug")
