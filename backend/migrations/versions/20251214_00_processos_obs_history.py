"""Create processos_obs_history table and triggers

Revision ID: 20251214_00_processos_obs_history
Revises: 20251212_02_cnds_add_cnpj
Create Date: 2025-12-14 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

# revision identifiers, used by Alembic.
revision = "20251214_00_processos_obs_history"
down_revision = "20251212_02_cnds_add_cnpj"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processos_obs_history",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("org_id", pg.UUID(as_uuid=False), nullable=False),
        sa.Column("processo_id", sa.Integer(), sa.ForeignKey("processos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("changed_by", pg.UUID(as_uuid=False), nullable=True),
        sa.Column("old_obs", sa.Text(), nullable=True),
        sa.Column("new_obs", sa.Text(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_processos_obs_history_org_processo_changed_at_desc
            ON processos_obs_history (org_id, processo_id, changed_at DESC);
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION log_processos_obs_history()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.obs IS NOT NULL AND btrim(NEW.obs) <> '' THEN
                        INSERT INTO processos_obs_history(org_id, processo_id, changed_by, old_obs, new_obs)
                        VALUES (NEW.org_id, NEW.id, NULL, NULL, NEW.obs);
                    END IF;
                ELSIF TG_OP = 'UPDATE' THEN
                    IF NEW.obs IS DISTINCT FROM OLD.obs THEN
                        INSERT INTO processos_obs_history(org_id, processo_id, changed_by, old_obs, new_obs)
                        VALUES (NEW.org_id, NEW.id, NULL, OLD.obs, NEW.obs);
                    END IF;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TRIGGER log_processos_obs_history_ai
            AFTER INSERT ON processos
            FOR EACH ROW
            EXECUTE FUNCTION log_processos_obs_history();
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TRIGGER log_processos_obs_history_au
            AFTER UPDATE OF obs ON processos
            FOR EACH ROW
            EXECUTE FUNCTION log_processos_obs_history();
            """
        )
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS log_processos_obs_history_au ON processos;")
    op.execute("DROP TRIGGER IF EXISTS log_processos_obs_history_ai ON processos;")
    op.execute("DROP FUNCTION IF EXISTS log_processos_obs_history();")
    op.execute(
        "DROP INDEX IF EXISTS ix_processos_obs_history_org_processo_changed_at_desc;"
    )
    op.drop_table("processos_obs_history")
