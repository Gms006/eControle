"""Add org_id to core tables and (re)create uniques per organization.

Revision ID: 20251103_01_add_org_id_and_uniques
Revises: 20251103_00_auth_core
Create Date: 2025-11-03 09:45:00-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import os

revision = "20251103_01_add_org_id_and_uniques"
down_revision = "20251103_00_auth_core"
branch_labels = None
depends_on = None

DEFAULT_ORG_ID = os.getenv("ORG_ID", "00000000-0000-0000-0000-000000000001")

TABLES_FINAL = [
    "empresas",
    "licencas",
    "taxas",
    "processos",
    "processos_avulsos",
]
TABLES_STG = [
    "stg_empresas",
    "stg_licencas",
    "stg_taxas",
    "stg_processos",
]


def _add_org_id(table):
    op.add_column(table, sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        f"fk_{table}_org", table, "orgs", ["org_id"], ["id"], ondelete="CASCADE"
    )
    op.execute(f"UPDATE {table} SET org_id = '{DEFAULT_ORG_ID}'::uuid WHERE org_id IS NULL;")
    op.alter_column(table, "org_id", nullable=False)


def _delete_duplicates(table, partition_cols, where_clause=None):
    partition_expr = ", ".join(partition_cols)
    where_sql = f"WHERE {where_clause}" if where_clause else ""
    op.execute(
        f"""
        DELETE FROM {table}
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY {partition_expr}
                        ORDER BY id
                    ) AS rn
                FROM {table}
                {where_sql}
            ) dedup
            WHERE dedup.rn > 1
        );
        """
    )


def _dedup_empresas_with_fk_repoint():
    # Reaponta FKs (licencas, taxas, processos) antes de deletar duplicatas de empresas.
    # "Vencedor" = menor id por (org_id, cnpj).
    op.execute(sa.text("""
    WITH d AS (
        SELECT id, org_id, cnpj,
               ROW_NUMBER() OVER (PARTITION BY org_id, cnpj ORDER BY id) AS rn
        FROM empresas
        WHERE cnpj IS NOT NULL
    ),
    pairs AS (
        -- old_id = id duplicado a ser apagado; new_id = id vencedor (rn=1)
        SELECT loser.id   AS old_id,
               winner.id  AS new_id
        FROM d loser
        JOIN d winner
          ON loser.org_id = winner.org_id
         AND loser.cnpj   = winner.cnpj
         AND winner.rn    = 1
        WHERE loser.rn > 1
    )
    -- 1) Reapontar filhos
    UPDATE licencas  l SET empresa_id = p.new_id FROM pairs p WHERE l.empresa_id = p.old_id;
    UPDATE taxas     t SET empresa_id = p.new_id FROM pairs p WHERE t.empresa_id = p.old_id;
    UPDATE processos pr SET empresa_id = p.new_id FROM pairs p WHERE pr.empresa_id = p.old_id;

    -- 2) Apagar perdedores
    DELETE FROM empresas e
    USING pairs p
    WHERE e.id = p.old_id;
    """))


def _ensure_default_org():
    # Garante a org default mesmo que a tabela 'orgs' não tenha slug
    op.execute(sa.text(f"""
        INSERT INTO orgs (id, name)
        VALUES ('{DEFAULT_ORG_ID}'::uuid, 'Neto Contabilidade')
        ON CONFLICT (id) DO NOTHING;
    """))

    # Se a coluna 'slug' existir, atualiza também (não falha se não houver)
    op.execute(sa.text(f"""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='orgs' AND column_name='slug'
        ) THEN
            UPDATE orgs
            SET slug = 'neto-contabilidade'
            WHERE id = '{DEFAULT_ORG_ID}'::uuid
              AND (slug IS NULL OR slug <> 'neto-contabilidade');
        END IF;
    END$$;
    """))


def upgrade():
    _ensure_default_org()

    # 1) adicionar org_id (finais e staging)
    for t in TABLES_FINAL:
        _add_org_id(t)
    for t in TABLES_STG:
        op.add_column(t, sa.Column("org_id", postgresql.UUID(as_uuid=False), nullable=True))
        op.execute(f"UPDATE {t} SET org_id = '{DEFAULT_ORG_ID}'::uuid WHERE org_id IS NULL;")
        op.alter_column(t, "org_id", nullable=False)

    # 2) soltar unicidades antigas (se existirem)
    safe_drops = [
        # EMPRESAS
        ("empresas", "uq_empresas_cnpj"),
        ("empresas", "uq_empresas_org_cnpj"),
        # LICENCAS
        ("licencas", "uq_licencas_empresa_tipo"),
        ("licencas", "uq_licencas_org_empresa_tipo"),
        # TAXAS
        ("taxas", "uq_taxas_empresa_tipo"),
        ("taxas", "uq_taxas_org_empresa_tipo"),
        # PROCESSOS (variantes)
        ("processos", "uq_processos_protocolo_tipo"),
        ("processos", "uq_proc_protocolo_tipo"),
        ("processos", "uq_proc_empresa_tipo_com_data"),
        ("processos", "uq_proc_empresa_tipo_sem_data"),
        ("processos", "uq_proc_empresa_tipo_sem_protocolo_sem_data"),
        # AVULSOS
        ("processos_avulsos", "uq_proc_avulso_protocolo_tipo"),
        ("processos_avulsos", "uq_proc_avulso_doc_tipo_data"),
        ("processos_avulsos", "idx_proc_avulso_doc_tipo_sem_data"),
        ("processos_avulsos", "idx_proc_avulso_doc_tipo_data"),
        ("processos_avulsos", "uq_proc_avulsos_doc_tipo_data"),
    ]
    for table, idx in safe_drops:
        try:
            op.execute(f'DROP INDEX IF EXISTS {idx};')
        except Exception:
            pass
        try:
            op.execute(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {idx};')
        except Exception:
            pass

    # 3) remover duplicatas de EMPRESAS com reapontamento de FKs
    _dedup_empresas_with_fk_repoint()
    _delete_duplicates(
        "licencas",
        ["org_id", "empresa_id", "tipo"],
        where_clause="empresa_id IS NOT NULL AND tipo IS NOT NULL",
    )
    _delete_duplicates(
        "taxas",
        ["org_id", "empresa_id", "tipo"],
        where_clause="empresa_id IS NOT NULL AND tipo IS NOT NULL",
    )
    _delete_duplicates(
        "processos",
        ["org_id", "protocolo", "tipo"],
        where_clause="protocolo IS NOT NULL",
    )
    _delete_duplicates(
        "processos",
        ["org_id", "empresa_id", "tipo", "data_solicitacao"],
        where_clause=(
            "protocolo IS NULL AND data_solicitacao IS NOT NULL AND "
            "empresa_id IS NOT NULL AND tipo IS NOT NULL"
        ),
    )
    _delete_duplicates(
        "processos",
        ["org_id", "empresa_id", "tipo"],
        where_clause=(
            "protocolo IS NULL AND data_solicitacao IS NULL AND "
            "empresa_id IS NOT NULL AND tipo IS NOT NULL"
        ),
    )
    _delete_duplicates(
        "processos_avulsos",
        ["org_id", "protocolo", "tipo"],
        where_clause="protocolo IS NOT NULL",
    )
    _delete_duplicates(
        "processos_avulsos",
        ["org_id", "documento", "tipo", "data_solicitacao"],
        where_clause=(
            "protocolo IS NULL AND data_solicitacao IS NOT NULL AND "
            "documento IS NOT NULL AND tipo IS NOT NULL"
        ),
    )
    _delete_duplicates(
        "processos_avulsos",
        ["org_id", "documento", "tipo"],
        where_clause=(
            "protocolo IS NULL AND data_solicitacao IS NULL AND "
            "documento IS NOT NULL AND tipo IS NOT NULL"
        ),
    )

    # 4) recriar unicidades por organização

    # EMPRESAS: CNPJ/CPF/CAEPF normalizado já está no pipeline
    op.create_index(
        "uq_empresas_org_cnpj", "empresas",
        ["org_id", "cnpj"], unique=True
    )

    # LICENCAS: uma por org + empresa + tipo
    op.create_index(
        "uq_licencas_org_empresa_tipo", "licencas",
        ["org_id", "empresa_id", "tipo"], unique=True
    )

    # TAXAS: uma por org + empresa + tipo
    op.create_index(
        "uq_taxas_org_empresa_tipo", "taxas",
        ["org_id", "empresa_id", "tipo"], unique=True
    )

    # PROCESSOS:
    # 3.1 protocolo presente => único por org + (protocolo, tipo)
    op.create_index(
        "uq_proc_org_protocolo_tipo",
        "processos",
        ["org_id", "protocolo", "tipo"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NOT NULL"),
    )
    # 3.2 sem protocolo e COM data => único por org + (empresa_id, tipo, data)
    op.create_index(
        "uq_proc_org_empresa_tipo_data",
        "processos",
        ["org_id", "empresa_id", "tipo", "data_solicitacao"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NULL AND data_solicitacao IS NOT NULL"),
    )
    # 3.3 sem protocolo e SEM data => único por org + (empresa_id, tipo)
    op.create_index(
        "uq_proc_org_empresa_tipo_sem_data",
        "processos",
        ["org_id", "empresa_id", "tipo"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NULL AND data_solicitacao IS NULL"),
    )

    # PROCESSOS AVULSOS (sem empresa_id):
    # 3.4 protocolo presente => único por org + (protocolo, tipo)
    op.create_index(
        "uq_proc_avulso_org_protocolo_tipo",
        "processos_avulsos",
        ["org_id", "protocolo", "tipo"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NOT NULL"),
    )
    # 3.5 sem protocolo e COM data => único por org + (documento, tipo, data)
    op.create_index(
        "uq_proc_avulso_org_doc_tipo_data",
        "processos_avulsos",
        ["org_id", "documento", "tipo", "data_solicitacao"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NULL AND data_solicitacao IS NOT NULL"),
    )
    # 3.6 sem protocolo e SEM data => único por org + (documento, tipo)
    op.create_index(
        "uq_proc_avulso_org_doc_tipo_sem_data",
        "processos_avulsos",
        ["org_id", "documento", "tipo"],
        unique=True,
        postgresql_where=sa.text("protocolo IS NULL AND data_solicitacao IS NULL"),
    )


def downgrade():
    # drop novos índices
    for idx in [
        "uq_empresas_org_cnpj",
        "uq_licencas_org_empresa_tipo",
        "uq_taxas_org_empresa_tipo",
        "uq_proc_org_protocolo_tipo",
        "uq_proc_org_empresa_tipo_data",
        "uq_proc_org_empresa_tipo_sem_data",
        "uq_proc_avulso_org_protocolo_tipo",
        "uq_proc_avulso_org_doc_tipo_data",
        "uq_proc_avulso_org_doc_tipo_sem_data",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {idx};")

    # remover FKs e colunas org_id
    for t in TABLES_STG:
        try:
            op.drop_constraint(f"fk_{t}_org", t, type_="foreignkey")
        except Exception:
            pass
        op.drop_column(t, "org_id")

    for t in TABLES_FINAL:
        try:
            op.drop_constraint(f"fk_{t}_org", t, type_="foreignkey")
        except Exception:
            pass
        op.drop_column(t, "org_id")
