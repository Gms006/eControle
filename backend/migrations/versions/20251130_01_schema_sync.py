"""Sync schema changes from manual updates"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20251130_01_schema_sync"
down_revision = "20251112_01_certificados_agend"
branch_labels = None
depends_on = None


responsavel_fiscal_enum = postgresql.ENUM(
    "Carla",
    "Denise",
    "Fernando",
    name="responsavel_fiscal_enum",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    responsavel_fiscal_enum.create(bind, checkfirst=True)

    def add_column_if_missing(table_name: str, column: sa.Column) -> None:
        refreshed_inspector = sa.inspect(bind)
        existing_columns = {col["name"] for col in refreshed_inspector.get_columns(table_name)}
        if column.name not in existing_columns:
            op.add_column(table_name, column)

    add_column_if_missing("empresas", sa.Column("inscricao_municipal", sa.Text(), nullable=True))
    add_column_if_missing("empresas", sa.Column("inscricao_estadual", sa.Text(), nullable=True))
    add_column_if_missing("empresas", sa.Column("responsavel_legal", sa.Text(), nullable=True))
    add_column_if_missing("empresas", sa.Column("cpf_responsavel_legal", sa.Text(), nullable=True))
    add_column_if_missing(
        "empresas",
        sa.Column("responsavel_fiscal", responsavel_fiscal_enum, nullable=True),
    )

    if not inspector.has_table("empresas_backup_categoria"):
        op.create_table(
            "empresas_backup_categoria",
            sa.Column("id", sa.Integer(), nullable=True),
            sa.Column("cnpj", sa.String(length=14), nullable=True),
            sa.Column("categoria", sa.String(length=120), nullable=True),
        )

    if not inspector.has_table("cnds"):
        op.create_table(
            "cnds",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("org_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("orgs.id"), nullable=False),
            sa.Column(
                "empresa_id",
                sa.Integer(),
                sa.ForeignKey("empresas.id"),
                nullable=False,
            ),
            sa.Column("esfera", sa.String(), nullable=False),
            sa.Column("orgao", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("url", sa.Text(), nullable=True),
            sa.Column("data_emissao", sa.Date(), nullable=True),
            sa.Column("validade", sa.Date(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    refreshed_inspector = sa.inspect(bind)
    existing_cnds_indexes = {idx["name"] for idx in refreshed_inspector.get_indexes("cnds")}
    if "idx_cnds_org_empresa" not in existing_cnds_indexes:
        op.create_index(
            "idx_cnds_org_empresa",
            "cnds",
            ["org_id", "empresa_id"],
        )

    # NOVO PASSO: Remover as views dependentes antes de recriar as funções.
    # Isso resolve o erro DependentObjectsStillExist.
    op.execute("DROP VIEW IF EXISTS public.v_taxas_tpi")
    op.execute("DROP VIEW IF EXISTS public.v_modelos_uteis")
    op.execute("DROP VIEW IF EXISTS public.v_licencas_api")
    op.execute("DROP VIEW IF EXISTS public.v_contatos_uteis")

    # Passo 1: Recriar a função clean_status_label
    op.execute("DROP FUNCTION IF EXISTS public.clean_status_label(text)")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.clean_status_label(src text) RETURNS text
            LANGUAGE sql IMMUTABLE
            AS $_$
          WITH t0 AS (
            SELECT coalesce(src, '') AS s
          ),
          -- remove qualquer data dd/mm/yyyy ou dd-mm-yyyy
          t1 AS (
            SELECT regexp_replace(s, '(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', '', 'g') AS s
            FROM t0
          ),
          -- remove sufixos como " . Val", " - Validade", " - Venc." no fim da string
          t2 AS (
            SELECT regexp_replace(
                     s,
                     '([[:space:]\.\---]*)(VAL(IDADE)?|VENC\.?)\.?[[:space:]]*$',
                     '',
                     'gi'
                   ) AS s
            FROM t1
          ),
          -- trim de pontuação/traços/espaços
          t3 AS (
            SELECT btrim(s, ' .--,;-') AS s
            FROM t2
          )
          SELECT
            CASE
              WHEN s ~* '\bvenc'   THEN 'Vencido'
              WHEN s ~* '\bposs'   THEN 'Possui'
              WHEN s ~* '\bdisp'   THEN 'Dispensa'
              WHEN s ~* '\bsuje'   THEN 'Sujeito'
              ELSE s
            END
          FROM t3;
        $_$;
        """
    )

    # Passo 2: Recriar a função extract_first_br_date
    op.execute("DROP FUNCTION IF EXISTS public.extract_first_br_date(text)")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.extract_first_br_date(src text) RETURNS date
            LANGUAGE sql IMMUTABLE STRICT
            AS $$
          WITH m AS (
            SELECT regexp_match(src, '(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})') AS mm
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
        $$;
        """
    )

    # Passo 3: Recriar as views
    op.execute(
        """
        CREATE OR REPLACE VIEW public.v_contatos_uteis AS
         SELECT id,
            contato AS nome,
            email,
            telefone,
            categoria,
            org_id,
            created_at,
            updated_at,
            municipio,
            whatsapp
           FROM public.contatos c;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW public.v_licencas_api AS
         SELECT l.id AS licenca_id,
            l.empresa_id,
            l.org_id,
            e.empresa,
            e.cnpj,
            e.municipio,
            l.tipo,
            public.clean_status_label((l.status)::text) AS status,
            COALESCE(l.validade, public.extract_first_br_date((l.status)::text)) AS validade,
            to_char((COALESCE(l.validade, public.extract_first_br_date((l.status)::text)))::timestamp with time zone, 'DD/MM/YYYY'::text) AS validade_br,
                CASE
                    WHEN (COALESCE(l.validade, public.extract_first_br_date((l.status)::text)) IS NULL) THEN NULL::integer
                    ELSE (COALESCE(l.validade, public.extract_first_br_date((l.status)::text)) - CURRENT_DATE)
                END AS dias_para_vencer,
            l.obs,
            l.created_at,
            l.updated_at
           FROM (public.licencas l
             LEFT JOIN public.empresas e ON ((e.id = l.empresa_id)));
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW public.v_modelos_uteis AS
         SELECT id,
            modelo AS titulo,
            descricao AS conteudo,
            utilizacao AS categoria,
            org_id,
            created_at,
            updated_at
           FROM public.modelos m;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW public.v_taxas_tpi AS
         SELECT t.id,
            e.empresa,
            e.cnpj,
            t.status,
            to_char((t.vencimento_tpi)::timestamp with time zone, 'DD/MM'::text) AS vencimento_ddmm,
            t.vencimento_tpi AS vencimento_date,
            t.obs
           FROM (public.taxas t
             JOIN public.empresas e ON ((e.id = t.empresa_id)))
          WHERE ((t.tipo)::text = 'TPI'::text);
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS public.v_taxas_tpi")
    op.execute("DROP VIEW IF EXISTS public.v_modelos_uteis")
    op.execute("DROP VIEW IF EXISTS public.v_licencas_api")
    op.execute("DROP VIEW IF EXISTS public.v_contatos_uteis")

    op.execute("DROP FUNCTION IF EXISTS public.extract_first_br_date(text)")
    op.execute("DROP FUNCTION IF EXISTS public.clean_status_label(text)")

    op.drop_index("idx_cnds_org_empresa", table_name="cnds")
    op.drop_table("cnds")
    op.drop_table("empresas_backup_categoria")

    op.drop_column("empresas", "responsavel_fiscal")
    op.drop_column("empresas", "cpf_responsavel_legal")
    op.drop_column("empresas", "responsavel_legal")
    op.drop_column("empresas", "inscricao_estadual")
    op.drop_column("empresas", "inscricao_municipal")

    bind = op.get_bind()
    responsavel_fiscal_enum.drop(bind, checkfirst=True)