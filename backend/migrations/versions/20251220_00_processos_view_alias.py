"""Ensure processos view exposes enum columns"""

from alembic import op

revision = "20251220_00_processos_view_alias"
down_revision = "20251216_00_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_processos_resumo CASCADE;")
    op.execute(
        """
        CREATE VIEW v_processos_resumo AS
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
            p.operacao::text AS operacao,
            p.orgao::text AS orgao,
            p.alvara::text AS alvara,
            p.area_m2,
            p.projeto,
            p.inscricao_imobiliaria,
            p.servico::text AS servico,
            p.notificacao::text AS notificacao,
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


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_processos_resumo;")
