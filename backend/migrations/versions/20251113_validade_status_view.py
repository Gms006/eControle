"""Populate license validity from status and expose API view

Revision ID: 20251113_validade_status_view
Revises: 20251112_01_certificados_agend
Create Date: 2025-11-13 00:00:00
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20251113_validade_status_view"
down_revision = "20251112_01_certificados_agend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- funções utilitárias (criadas somente se não existirem para evitar erro de permissão)
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'extract_first_br_date'
          ) THEN
            EXECUTE $$
              CREATE FUNCTION public.extract_first_br_date(src text)
              RETURNS date
              LANGUAGE sql
              IMMUTABLE
              STRICT
              AS $$$$
                WITH m AS (
                  SELECT regexp_match(src, '(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})') AS mm
                )
                SELECT CASE
                         WHEN m.mm IS NULL THEN NULL::date
                         ELSE to_date(
                           lpad((m.mm)[1],2,'0') || '/' ||
                           lpad((m.mm)[2],2,'0') || '/' ||
                           (CASE WHEN length((m.mm)[3])=2 THEN '20' || (m.mm)[3] ELSE (m.mm)[3] END),
                           'DD/MM/YYYY'
                         )
                       END
                FROM m;
              $$$$;
            $$;
          END IF;
        END
        $$;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'clean_status_label'
          ) THEN
            EXECUTE $$
              CREATE FUNCTION public.clean_status_label(src text)
              RETURNS text
              LANGUAGE sql
              IMMUTABLE
              AS $$$$
                SELECT btrim(
                         regexp_replace(
                           regexp_replace(coalesce(src,''),'(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})','', 'g'),
                           '\\.?[\\s-]*(VAL\\.?|VALIDADE|VENC\\.?)\\b', '', 'gi'
                         ),
                         ' .–—,;-'
                       );
              $$$$;
            $$;
          END IF;
        END
        $$;

        -- trigger para preencher validade (só cria a função se não existir para evitar erro de ownership)
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'trg_licencas_fill_validade'
          ) THEN
            EXECUTE $$
              CREATE FUNCTION public.trg_licencas_fill_validade()
              RETURNS trigger
              LANGUAGE plpgsql
              AS $$$$
              BEGIN
                IF NEW.validade IS NULL AND NEW.status IS NOT NULL THEN
                  NEW.validade := extract_first_br_date(NEW.status);
                END IF;
                RETURN NEW;
              END;
              $$$$;
            $$;
          END IF;
        END
        $$;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
             WHERE tgname = 'licencas_fill_validade_biur'
               AND tgrelid = 'public.licencas'::regclass
          ) THEN
            EXECUTE $$
              CREATE TRIGGER licencas_fill_validade_biur
              BEFORE INSERT OR UPDATE ON public.licencas
              FOR EACH ROW
              EXECUTE FUNCTION public.trg_licencas_fill_validade();
            $$;
          END IF;
        END
        $$;

        -- view consumida pela API
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
          CASE
            WHEN COALESCE(l.validade, extract_first_br_date(l.status)) IS NULL THEN NULL
            ELSE to_char(COALESCE(l.validade, extract_first_br_date(l.status)), 'DD/MM/YYYY')
          END AS validade_br,
          CASE
            WHEN COALESCE(l.validade, extract_first_br_date(l.status)) IS NULL THEN NULL
            ELSE (COALESCE(l.validade, extract_first_br_date(l.status)) - CURRENT_DATE)
          END::int AS dias_para_vencer,
          l.obs,
          l.created_at,
          l.updated_at
        FROM public.licencas l
        LEFT JOIN public.empresas e ON e.id = l.empresa_id AND e.org_id = l.org_id
        WHERE current_setting('app.current_org', true) IS NULL
           OR l.org_id = current_setting('app.current_org')::uuid;
        """
    )
    op.execute("ALTER VIEW public.v_licencas_api OWNER TO CURRENT_USER;")


def downgrade() -> None:
    op.execute(
        """
        DROP VIEW IF EXISTS public.v_licencas_api;
        DROP TRIGGER IF EXISTS licencas_fill_validade_biur ON public.licencas;
        DROP FUNCTION IF EXISTS public.trg_licencas_fill_validade;
        DROP FUNCTION IF EXISTS public.clean_status_label;
        DROP FUNCTION IF EXISTS public.extract_first_br_date;
        """
    )
