"""Placeholder for missing revision be2b8ef49772

This migration was lost in history; it intentionally performs no schema changes
but preserves the revision chain so later migrations can be applied.
"""

from __future__ import annotations

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision = "be2b8ef49772"
down_revision = "20251106_01_s3_api_views_org_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op placeholder to restore migration continuity.
    pass


def downgrade() -> None:
    # No-op placeholder to restore migration continuity.
    pass
