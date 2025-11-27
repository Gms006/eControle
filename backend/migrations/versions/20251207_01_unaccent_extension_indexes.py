"""Add unaccent extension, immutable function, and normalized indexes"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20251207_01_unaccent_extension_indexes"
down_revision = "20251130_01_schema_sync"
branch_labels = None
depends_on = None

CREATE_EXTENSION = "CREATE EXTENSION IF NOT EXISTS unaccent"

CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS
$$
SELECT public.unaccent($1);
$$;
"""

DROP_FUNCTION = "DROP FUNCTION IF EXISTS public.immutable_unaccent(text)"

INDEXES = (
    """CREATE INDEX IF NOT EXISTS ix_empresas_org_empresa_norm
    ON public.empresas (org_id, lower(public.immutable_unaccent(empresa::text)))""",
    """CREATE INDEX IF NOT EXISTS ix_empresas_org_municipio_norm
    ON public.empresas (org_id, lower(public.immutable_unaccent(municipio::text)))""",
    """CREATE INDEX IF NOT EXISTS idx_contatos_org_nome
    ON public.contatos (org_id, lower(public.immutable_unaccent(contato::text)))""",
    """CREATE INDEX IF NOT EXISTS idx_modelos_org_titulo
    ON public.modelos (org_id, lower(public.immutable_unaccent(modelo)))""",
)

DROP_INDEXES = (
    "DROP INDEX IF EXISTS idx_modelos_org_titulo",
    "DROP INDEX IF EXISTS idx_contatos_org_nome",
    "DROP INDEX IF EXISTS ix_empresas_org_municipio_norm",
    "DROP INDEX IF EXISTS ix_empresas_org_empresa_norm",
)


def upgrade() -> None:
    op.execute(CREATE_EXTENSION)
    op.execute(CREATE_FUNCTION)

    for statement in INDEXES:
        op.execute(statement)


def downgrade() -> None:
    for statement in DROP_INDEXES:
        op.execute(statement)

    op.execute(DROP_FUNCTION)
