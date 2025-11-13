"""Consolidate status cleaning and API view changes"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20251114_00_merge_status_view_clean"
down_revision = "20251113_validade_status_view"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.clean_status_label(src text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        AS $$
          WITH t0 AS (
            SELECT coalesce(src, '') AS s
          ),
          t1 AS (
            SELECT regexp_replace(s, '(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})', '', 'g') AS s
            FROM t0
          ),
          t2 AS (
            SELECT regexp_replace(
                     s,
                     '([[:space:]\\.\\-–—]*)(VAL(IDADE)?|VENC\\.?)\\.?[[:space:]]*$',
                     '',
                     'gi'
                   ) AS s
            FROM t1
          ),
          t3 AS (
            SELECT btrim(s, ' .–—,;-') AS s
            FROM t2
          )
          SELECT
            CASE
              WHEN s ~* '\\bvenc'   THEN 'Vencido'
              WHEN s ~* '\\bposs'   THEN 'Possui'
              WHEN s ~* '\\bdisp'   THEN 'Dispensa'
              WHEN s ~* '\\bsuje'   THEN 'Sujeito'
              ELSE s
            END
          FROM t3;
        $$;

        CREATE OR REPLACE VIEW public.v_licencas_api AS
        SELECT
          l.id               AS licenca_id,
          l.empresa_id,
          l.org_id,
          e.empresa,
          e.cnpj,
          e.municipio,
          l.tipo,
          clean_status_label(l.status) AS status,
          COALESCE(l.validade, extract_first_br_date(l.status)) AS validade,
          to_char(COALESCE(l.validade, extract_first_br_date(l.status)), 'DD/MM/YYYY') AS validade_br,
          CASE
            WHEN COALESCE(l.validade, extract_first_br_date(l.status)) IS NULL THEN NULL
            ELSE (COALESCE(l.validade, extract_first_br_date(l.status)) - CURRENT_DATE)
          END::int AS dias_para_vencer,
          l.obs,
          l.created_at,
          l.updated_at
        FROM public.licencas l
        LEFT JOIN public.empresas e ON e.id = l.empresa_id;

        GRANT SELECT ON public.v_licencas_api TO econtrole;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        REVOKE SELECT ON public.v_licencas_api FROM econtrole;
        DROP VIEW IF EXISTS public.v_licencas_api;
        DROP FUNCTION IF EXISTS public.clean_status_label;
        """
    )
