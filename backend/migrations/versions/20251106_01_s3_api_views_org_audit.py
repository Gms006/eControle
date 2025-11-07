"""S3 API adjustments: ensure audit columns and multi-tenant views"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20251106_01_s3_api_views_org_audit"
down_revision = "20251104_01_uq_users_org_email"
branch_labels = None
depends_on = None


TABLES = ("empresas", "licencas", "taxas", "processos")


def _ensure_audit_columns(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS org_id uuid")
    op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_by integer")
    op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS updated_by integer")
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_{table}_org'
            ) THEN
                ALTER TABLE {table}
                    ADD CONSTRAINT fk_{table}_org
                    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_{table}_created_by'
            ) THEN
                ALTER TABLE {table}
                    ADD CONSTRAINT fk_{table}_created_by
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_{table}_updated_by'
            ) THEN
                ALTER TABLE {table}
                    ADD CONSTRAINT fk_{table}_updated_by
                    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END$$;
        """
    )


def _create_views() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW v_empresas AS
        SELECT
            e.id AS empresa_id,
            e.org_id,
            e.empresa,
            e.cnpj,
            e.municipio,
            e.porte,
            e.categoria,
            e.status_empresas,
            e.situacao,
            e.debito,
            e.certificado,
            COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL), 0) AS total_licencas,
            COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), 0) AS total_taxas,
            COALESCE(COUNT(DISTINCT p.id) FILTER (
                WHERE (p.prazo IS NULL OR p.prazo >= CURRENT_DATE)
            ), 0) AS processos_ativos,
            e.updated_at
        FROM empresas e
        LEFT JOIN licencas l ON l.empresa_id = e.id AND l.org_id = e.org_id
        LEFT JOIN taxas t ON t.empresa_id = e.id AND t.org_id = e.org_id
        LEFT JOIN processos p ON p.empresa_id = e.id AND p.org_id = e.org_id
        WHERE current_setting('app.current_org', true) IS NULL
          OR e.org_id = current_setting('app.current_org')::uuid
        GROUP BY e.id, e.org_id, e.empresa, e.cnpj, e.municipio, e.porte, e.categoria,
                 e.status_empresas, e.situacao, e.debito, e.certificado, e.updated_at;
        """
    )
    op.execute("ALTER VIEW v_empresas OWNER TO CURRENT_USER;")

    op.execute(
        """
        CREATE OR REPLACE VIEW v_licencas_status AS
        SELECT
            l.id AS licenca_id,
            e.id AS empresa_id,
            e.org_id,
            e.empresa,
            e.cnpj,
            e.municipio,
            l.tipo,
            l.status,
            l.validade,
            CASE WHEN l.validade IS NULL THEN NULL ELSE (l.validade - CURRENT_DATE) END AS dias_para_vencer
        FROM licencas l
        JOIN empresas e ON e.id = l.empresa_id AND e.org_id = l.org_id
        WHERE current_setting('app.current_org', true) IS NULL
          OR e.org_id = current_setting('app.current_org')::uuid;
        """
    )
    op.execute("ALTER VIEW v_licencas_status OWNER TO CURRENT_USER;")

    op.execute(
        """
        CREATE OR REPLACE VIEW v_taxas_status AS
        SELECT
            t.id AS taxa_id,
            e.id AS empresa_id,
            e.org_id,
            e.empresa,
            e.cnpj,
            t.tipo,
            t.status,
            t.data_envio,
            t.vencimento_tpi,
            (LOWER(COALESCE(t.status, '')) LIKE 'pago%') AS esta_pago
        FROM taxas t
        JOIN empresas e ON e.id = t.empresa_id AND e.org_id = t.org_id
        WHERE current_setting('app.current_org', true) IS NULL
          OR e.org_id = current_setting('app.current_org')::uuid;
        """
    )
    op.execute("ALTER VIEW v_taxas_status OWNER TO CURRENT_USER;")

    op.execute(
        """
        CREATE OR REPLACE VIEW v_processos_resumo AS
        SELECT
            p.id AS processo_id,
            e.id AS empresa_id,
            p.org_id,
            e.empresa,
            e.cnpj,
            p.tipo,
            p.protocolo,
            p.data_solicitacao,
            p.situacao,
            p.status_padrao,
            p.prazo,
            CASE
                WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%conclu%'
                     OR LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%licenc%'
                     OR LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%aprov%'
                    THEN 'success'
                WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%vencid%'
                     OR LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%indefer%'
                    THEN 'danger'
                WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%aguard%'
                     OR LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%pend%'
                    THEN 'warning'
                ELSE NULL
            END AS status_cor
        FROM processos p
        JOIN empresas e ON e.id = p.empresa_id AND e.org_id = p.org_id
        WHERE current_setting('app.current_org', true) IS NULL
          OR e.org_id = current_setting('app.current_org')::uuid;
        """
    )
    op.execute("ALTER VIEW v_processos_resumo OWNER TO CURRENT_USER;")

    op.execute(
        """
        CREATE OR REPLACE VIEW v_alertas_vencendo_30d AS
        WITH base AS (
            SELECT
                e.org_id,
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'LICENCA'::text AS tipo_alerta,
                l.tipo || ' - ' || l.status AS descricao,
                l.validade,
                (l.validade - CURRENT_DATE) AS dias_restantes
            FROM licencas l
            JOIN empresas e ON e.id = l.empresa_id AND e.org_id = l.org_id
            WHERE (
                current_setting('app.current_org', true) IS NULL
                OR e.org_id = current_setting('app.current_org')::uuid
            )
              AND l.validade IS NOT NULL
              AND l.validade <= CURRENT_DATE + INTERVAL '30 days'
            UNION ALL
            SELECT
                e.org_id,
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'TAXA'::text AS tipo_alerta,
                t.tipo || ' - ' || t.status AS descricao,
                t.vencimento_tpi AS validade,
                CASE WHEN t.vencimento_tpi IS NULL THEN NULL ELSE (t.vencimento_tpi - CURRENT_DATE) END AS dias_restantes
            FROM taxas t
            JOIN empresas e ON e.id = t.empresa_id AND e.org_id = t.org_id
            WHERE (
                current_setting('app.current_org', true) IS NULL
                OR e.org_id = current_setting('app.current_org')::uuid
            )
              AND LOWER(COALESCE(t.status, '')) NOT LIKE 'pago%'
            UNION ALL
            SELECT
                e.org_id,
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'PROCESSO'::text AS tipo_alerta,
                p.tipo || ' - ' || p.situacao::text AS descricao,
                p.prazo AS validade,
                CASE WHEN p.prazo IS NULL THEN NULL ELSE (p.prazo - CURRENT_DATE) END AS dias_restantes
            FROM processos p
            JOIN empresas e ON e.id = p.empresa_id AND e.org_id = p.org_id
            WHERE (
                current_setting('app.current_org', true) IS NULL
                OR e.org_id = current_setting('app.current_org')::uuid
            )
              AND p.prazo IS NOT NULL
              AND p.prazo <= CURRENT_DATE + INTERVAL '30 days'
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY empresa, tipo_alerta, COALESCE(validade, CURRENT_DATE)) AS alerta_id,
            org_id,
            empresa_id,
            empresa,
            cnpj,
            tipo_alerta,
            descricao,
            validade,
            dias_restantes
        FROM base;
        """
    )
    op.execute("ALTER VIEW v_alertas_vencendo_30d OWNER TO CURRENT_USER;")

    op.execute(
        """
        CREATE OR REPLACE VIEW v_grupos_kpis AS
        WITH emp AS (
            SELECT
                e.org_id,
                COUNT(*)::bigint AS total_empresas,
                COUNT(*) FILTER (
                    WHERE COALESCE(e.certificado, '') NOT ILIKE 'sim%'
                )::bigint AS sem_certificado
            FROM empresas e
            GROUP BY e.org_id
        ),
        lic_venc AS (
            SELECT
                l.org_id,
                COUNT(*) FILTER (
                    WHERE l.validade IS NOT NULL AND l.validade < CURRENT_DATE
                )::bigint AS licencas_vencidas
            FROM licencas l
            GROUP BY l.org_id
        ),
        tpi_pend AS (
            SELECT
                t.org_id,
                COUNT(*) FILTER (
                    WHERE (LOWER(COALESCE(t.status, '')) NOT LIKE 'pago%')
                      AND (UPPER(t.tipo) LIKE 'TPI%')
                )::bigint AS tpi_pendente
            FROM taxas t
            GROUP BY t.org_id
        ),
        unioned AS (
            SELECT emp.org_id, 'empresas'::text AS grupo, 'total_empresas'::text AS chave, emp.total_empresas::bigint AS valor FROM emp
            UNION ALL
            SELECT emp.org_id, 'empresas'::text AS grupo, 'sem_certificado'::text AS chave, emp.sem_certificado::bigint AS valor FROM emp
            UNION ALL
            SELECT l.org_id, 'licencas'::text AS grupo, 'licencas_vencidas'::text AS chave, COALESCE(l.licencas_vencidas, 0)::bigint AS valor FROM lic_venc l
            UNION ALL
            SELECT t.org_id, 'taxas'::text AS grupo, 'tpi_pendente'::text AS chave, COALESCE(t.tpi_pendente, 0)::bigint AS valor FROM tpi_pend t
        )
        SELECT *
        FROM unioned
        WHERE current_setting('app.current_org', true) IS NULL
           OR org_id = current_setting('app.current_org')::uuid;
        """
    )
    op.execute("ALTER VIEW v_grupos_kpis OWNER TO CURRENT_USER;")


def upgrade() -> None:
    for table in TABLES:
        _ensure_audit_columns(table)
    _create_views()


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_grupos_kpis")
    op.execute("DROP VIEW IF EXISTS v_alertas_vencendo_30d")
    op.execute("DROP VIEW IF EXISTS v_processos_resumo")
    op.execute("DROP VIEW IF EXISTS v_taxas_status")
    op.execute("DROP VIEW IF EXISTS v_licencas_status")
    op.execute("DROP VIEW IF EXISTS v_empresas")
