"""Schema v1 initial migration."""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Dict

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
import yaml

revision = "20250101_01"
down_revision = None
branch_labels = None
depends_on = None

BASE_DIR = Path(__file__).resolve().parents[2]
CONFIG_DEFAULT_PATH = BASE_DIR / "config.yaml"
_config_env = os.getenv("CONFIG_PATH")
if _config_env:
    _config_path = Path(_config_env)
    if not _config_path.is_absolute():
        _config_path = (BASE_DIR / _config_env).resolve()
else:
    _config_path = CONFIG_DEFAULT_PATH

CONFIG_PATH = _config_path
if not CONFIG_PATH.exists():
    raise FileNotFoundError(f"Arquivo de configuração não encontrado em {CONFIG_PATH}")

with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
    CONFIG_DATA: Dict[str, list[str]] = yaml.safe_load(config_file).get("enums", {})

ENUM_NAME_MAP = {
    "situacao_processos": "situacao_processo_enum",
    "operacoes_diversos": "operacao_diversos_enum",
    "orgaos_diversos": "orgao_diversos_enum",
    "alvaras_funcionamento": "alvara_funcionamento_enum",
    "servicos_sanitarios": "servico_sanitario_enum",
    "notificacoes_sanitarias": "notificacao_sanitaria_enum",
    "categorias_contato": "categoria_contato_enum",
}


def build_enum(enum_key: str) -> postgresql.ENUM:
    values = CONFIG_DATA.get(enum_key)
    if not values:
        raise KeyError(f"Enum '{enum_key}' not found in config.yaml")
    return postgresql.ENUM(*values, name=ENUM_NAME_MAP[enum_key], create_type=False)


def upgrade() -> None:
    situacao_enum = build_enum("situacao_processos")
    operacao_enum = build_enum("operacoes_diversos")
    orgao_enum = build_enum("orgaos_diversos")
    alvara_enum = build_enum("alvaras_funcionamento")
    servico_enum = build_enum("servicos_sanitarios")
    notificacao_enum = build_enum("notificacoes_sanitarias")
    categoria_enum = build_enum("categorias_contato")

    bind = op.get_bind()
    for enum_type in (situacao_enum, operacao_enum, orgao_enum, alvara_enum, servico_enum, notificacao_enum, categoria_enum):
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "empresas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa", sa.String(length=255), nullable=False),
        sa.Column("cnpj", sa.String(length=14), nullable=False),
        sa.Column("porte", sa.String(length=50)),
        sa.Column("municipio", sa.String(length=120), nullable=False),
        sa.Column("status_empresas", sa.String(length=50), nullable=False, server_default="Ativa"),
        sa.Column("categoria", sa.String(length=120)),
        sa.Column("ie", sa.String(length=50)),
        sa.Column("im", sa.String(length=50)),
        sa.Column("situacao", sa.String(length=120)),
        sa.Column("debito", sa.String(length=120)),
        sa.Column("certificado", sa.String(length=120)),
        sa.Column("obs", sa.Text),
        sa.Column("proprietario", sa.String(length=255)),
        sa.Column("cpf", sa.String(length=14)),
        sa.Column("telefone", sa.String(length=60)),
        sa.Column("email", sa.String(length=255)),
        sa.Column("responsavel", sa.String(length=255)),
        sa.Column("updated_at", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("char_length(cnpj) = 14 AND cnpj ~ '^[0-9]+$'", name="ck_empresas_cnpj_formato"),
        sa.UniqueConstraint("cnpj", name="uq_empresas_cnpj"),
    )
    op.create_index("idx_empresas_municipio", "empresas", ["municipio"])

    op.create_table(
        "contatos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("contato", sa.String(length=255), nullable=False),
        sa.Column("municipio", sa.String(length=120)),
        sa.Column("telefone", sa.String(length=60)),
        sa.Column("whatsapp", sa.String(length=10), nullable=False, server_default="NÃO"),
        sa.Column("email", sa.String(length=255)),
        sa.Column("categoria", categoria_enum, nullable=False),
    )
    op.create_index("idx_contatos_categoria", "contatos", ["categoria"])

    op.create_table(
        "modelos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("modelo", sa.Text, nullable=False),
        sa.Column("descricao", sa.String(length=255)),
        sa.Column("utilizacao", sa.String(length=120), nullable=False, server_default="WhatsApp"),
    )
    op.create_index("idx_modelos_utilizacao", "modelos", ["utilizacao"])

    op.create_table(
        "licencas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=120), nullable=False),
        sa.Column("validade", sa.Date),
        sa.Column("obs", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()")),
        sa.CheckConstraint("(validade IS NULL) OR (validade >= DATE '1900-01-01')", name="ck_licencas_validade"),
    )
    op.create_index("idx_licencas_empresa_tipo", "licencas", ["empresa_id", "tipo"])
    op.create_index("idx_licencas_validade", "licencas", ["validade"])

    op.create_table(
        "taxas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=120), nullable=False),
        sa.Column("data_envio", sa.Date),
        sa.Column("obs", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()")),
    )
    op.create_index("idx_taxas_empresa_tipo", "taxas", ["empresa_id", "tipo"])
    op.create_index("idx_taxas_status", "taxas", ["status"])

    op.create_table(
        "processos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("protocolo", sa.String(length=120), nullable=False),
        sa.Column("data_solicitacao", sa.Date, nullable=False),
        sa.Column("situacao", situacao_enum, nullable=False),
        sa.Column("status_padrao", sa.String(length=120)),
        sa.Column("obs", sa.Text),
        sa.Column("prazo", sa.Date),
        sa.Column("operacao", operacao_enum, nullable=True),
        sa.Column("orgao", orgao_enum, nullable=True),
        sa.Column("alvara", alvara_enum, nullable=True),
        sa.Column("municipio", sa.String(length=120), nullable=True),
        sa.Column("tpi", sa.String(length=120)),
        sa.Column("inscricao_imobiliaria", sa.String(length=120)),
        sa.Column("servico", servico_enum, nullable=True),
        sa.Column("taxa", sa.String(length=120), nullable=True),
        sa.Column("notificacao", notificacao_enum, nullable=True),
        sa.Column("data_val", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()")),
        sa.CheckConstraint("prazo IS NULL OR prazo >= data_solicitacao", name="ck_processos_prazo"),
        sa.UniqueConstraint("protocolo", "tipo", name="uq_processos_protocolo_tipo"),
    )
    op.create_index("idx_processos_empresa_tipo", "processos", ["empresa_id", "tipo"])
    op.create_index("idx_processos_situacao", "processos", ["situacao"])
    op.create_index("idx_processos_prazo", "processos", ["prazo"])

    op.execute(
        sa.text(
            """
            CREATE VIEW v_empresas AS
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                e.municipio,
                e.porte,
                e.categoria,
                e.situacao,
                e.status_empresas,
                e.debito,
                e.certificado,
                COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL), 0) AS total_licencas,
                COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), 0) AS total_taxas,
                COALESCE(COUNT(DISTINCT p.id) FILTER (WHERE p.prazo IS NULL OR p.prazo >= CURRENT_DATE), 0) AS processos_ativos,
                e.updated_at
            FROM empresas e
            LEFT JOIN licencas l ON l.empresa_id = e.id
            LEFT JOIN taxas t ON t.empresa_id = e.id
            LEFT JOIN processos p ON p.empresa_id = e.id
            GROUP BY e.id
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE VIEW v_licencas_status AS
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                e.municipio,
                l.tipo,
                l.status,
                l.validade,
                CASE WHEN l.validade IS NULL THEN NULL ELSE (l.validade - CURRENT_DATE) END AS dias_para_vencer
            FROM licencas l
            JOIN empresas e ON e.id = l.empresa_id
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE VIEW v_taxas_status AS
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                t.tipo,
                t.status,
                t.data_envio,
                (LOWER(t.status) LIKE 'pago%') AS esta_pago
            FROM taxas t
            JOIN empresas e ON e.id = t.empresa_id
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE VIEW v_processos_resumo AS
            SELECT
                p.id AS processo_id,
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                p.tipo,
                p.protocolo,
                p.data_solicitacao,
                p.situacao,
                p.status_padrao,
                p.prazo,
                CASE
                    WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%conclu%' OR
                         LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%licenc%' OR
                         LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%aprov%'
                        THEN '🟢'
                    WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%vencid%' OR
                         LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%indefer%'
                        THEN '🔴'
                    WHEN LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%aguard%' OR
                         LOWER(COALESCE(p.status_padrao, p.situacao::text)) LIKE '%pendente%'
                        THEN '🟡'
                    ELSE '🔵'
                END AS status_cor
            FROM processos p
            JOIN empresas e ON e.id = p.empresa_id
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE VIEW v_alertas_vencendo_30d AS
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'LICENCA' AS tipo_alerta,
                l.tipo || ' - ' || l.status AS descricao,
                l.validade,
                (l.validade - CURRENT_DATE) AS dias_restantes
            FROM licencas l
            JOIN empresas e ON e.id = l.empresa_id
            WHERE l.validade IS NOT NULL
              AND l.validade <= CURRENT_DATE + INTERVAL '30 days'
            UNION ALL
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'TAXA' AS tipo_alerta,
                t.tipo || ' - ' || t.status AS descricao,
                NULL::date AS validade,
                NULL::integer AS dias_restantes
            FROM taxas t
            JOIN empresas e ON e.id = t.empresa_id
            WHERE LOWER(t.status) NOT LIKE 'pago%'
              AND (LOWER(t.status) LIKE '%venc%' OR LOWER(t.status) LIKE '%pend%' OR LOWER(t.status) LIKE '%abert%' OR LOWER(t.status) LIKE '%nao%' OR LOWER(t.status) LIKE '%não%')
            UNION ALL
            SELECT
                e.id AS empresa_id,
                e.empresa,
                e.cnpj,
                'PROCESSO' AS tipo_alerta,
                p.tipo || ' - ' || p.situacao::text AS descricao,
                p.prazo AS validade,
                CASE WHEN p.prazo IS NULL THEN NULL ELSE (p.prazo - CURRENT_DATE) END AS dias_restantes
            FROM processos p
            JOIN empresas e ON e.id = p.empresa_id
            WHERE p.prazo IS NOT NULL
              AND p.prazo <= CURRENT_DATE + INTERVAL '30 days'
            """
        )
    )

    empresas_table = sa.table(
        "empresas",
        sa.column("id", sa.Integer),
        sa.column("empresa", sa.String),
        sa.column("cnpj", sa.String),
        sa.column("porte", sa.String),
        sa.column("municipio", sa.String),
        sa.column("status_empresas", sa.String),
        sa.column("categoria", sa.String),
        sa.column("situacao", sa.String),
        sa.column("debito", sa.String),
        sa.column("certificado", sa.String),
        sa.column("updated_at", sa.Date),
    )

    op.bulk_insert(
        empresas_table,
        [
            {
                "id": 1,
                "empresa": "Alpha Serviços Ltda",
                "cnpj": "12345678000190",
                "porte": "ME",
                "municipio": "Anápolis",
                "status_empresas": "Ativa",
                "categoria": "Serviços",
                "situacao": "Em dia",
                "debito": "Não",
                "certificado": "Sim",
                "updated_at": date.today(),
            },
            {
                "id": 2,
                "empresa": "Beta Indústria ME",
                "cnpj": "98765432000110",
                "porte": "EPP",
                "municipio": "Goiânia",
                "status_empresas": "Em acompanhamento",
                "categoria": "Indústria",
                "situacao": "Com pendências",
                "debito": "Sim",
                "certificado": "Não",
                "updated_at": date.today(),
            },
        ],
    )

    licencas_table = sa.table(
        "licencas",
        sa.column("empresa_id", sa.Integer),
        sa.column("tipo", sa.String),
        sa.column("status", sa.String),
        sa.column("validade", sa.Date),
        sa.column("obs", sa.Text),
    )

    op.bulk_insert(
        licencas_table,
        [
            {
                "empresa_id": 1,
                "tipo": "SANITARIA",
                "status": "Regular",
                "validade": date.today() + timedelta(days=15),
                "obs": "Próxima renovação em 15 dias",
            },
            {
                "empresa_id": 1,
                "tipo": "FUNCIONAMENTO",
                "status": "Vence em 20 dias",
                "validade": date.today() + timedelta(days=20),
                "obs": "Acompanhar vistoria",
            },
            {
                "empresa_id": 2,
                "tipo": "CERCON",
                "status": "Vencido",
                "validade": date.today() - timedelta(days=5),
                "obs": "Requer renovação imediata",
            },
        ],
    )

    taxas_table = sa.table(
        "taxas",
        sa.column("empresa_id", sa.Integer),
        sa.column("tipo", sa.String),
        sa.column("status", sa.String),
        sa.column("data_envio", sa.Date),
        sa.column("obs", sa.Text),
    )

    op.bulk_insert(
        taxas_table,
        [
            {
                "empresa_id": 1,
                "tipo": "TPI",
                "status": "Pago",
                "data_envio": date.today() - timedelta(days=30),
                "obs": "Pago via boleto",
            },
            {
                "empresa_id": 1,
                "tipo": "FUNCIONAMENTO",
                "status": "Aberto",
                "data_envio": date.today() - timedelta(days=10),
                "obs": "Aguardando pagamento",
            },
            {
                "empresa_id": 2,
                "tipo": "SANITARIA",
                "status": "Vencido",
                "data_envio": date.today() - timedelta(days=40),
                "obs": "Multa aplicada",
            },
        ],
    )

    processos_table = sa.table(
        "processos",
        sa.column("empresa_id", sa.Integer),
        sa.column("tipo", sa.String),
        sa.column("protocolo", sa.String),
        sa.column("data_solicitacao", sa.Date),
        sa.column("situacao", situacao_enum),
        sa.column("status_padrao", sa.String),
        sa.column("obs", sa.Text),
        sa.column("prazo", sa.Date),
        sa.column("operacao", operacao_enum),
        sa.column("orgao", orgao_enum),
        sa.column("alvara", alvara_enum),
        sa.column("municipio", sa.String),
        sa.column("tpi", sa.String),
        sa.column("inscricao_imobiliaria", sa.String),
        sa.column("servico", servico_enum),
        sa.column("taxa", sa.String),
        sa.column("notificacao", notificacao_enum),
        sa.column("data_val", sa.Date),
    )

    op.bulk_insert(
        processos_table,
        [
            {
                "empresa_id": 1,
                "tipo": "Diversos",
                "protocolo": "2024-0001",
                "data_solicitacao": date.today() - timedelta(days=25),
                "situacao": CONFIG_DATA["situacao_processos"][0],
                "status_padrao": "Aguardando documentos",
                "obs": "Enviar contrato social atualizado",
                "prazo": date.today() + timedelta(days=10),
                "operacao": CONFIG_DATA["operacoes_diversos"][0],
                "orgao": CONFIG_DATA["orgaos_diversos"][0],
                "alvara": None,
                "municipio": "Anápolis",
                "tpi": None,
                "inscricao_imobiliaria": None,
                "servico": None,
                "taxa": None,
                "notificacao": None,
                "data_val": None,
            },
            {
                "empresa_id": 1,
                "tipo": "Funcionamento",
                "protocolo": "2024-0002",
                "data_solicitacao": date.today() - timedelta(days=40),
                "situacao": CONFIG_DATA["situacao_processos"][2],
                "status_padrao": "Em análise",
                "obs": "Vistoria agendada",
                "prazo": date.today() + timedelta(days=5),
                "operacao": None,
                "orgao": None,
                "alvara": CONFIG_DATA["alvaras_funcionamento"][1],
                "municipio": "Anápolis",
                "tpi": None,
                "inscricao_imobiliaria": None,
                "servico": None,
                "taxa": None,
                "notificacao": None,
                "data_val": None,
            },
            {
                "empresa_id": 2,
                "tipo": "Sanitário",
                "protocolo": "2024-0003",
                "data_solicitacao": date.today() - timedelta(days=15),
                "situacao": CONFIG_DATA["situacao_processos"][3],
                "status_padrao": "Pendente taxa",
                "obs": "Aguardando pagamento",
                "prazo": date.today() + timedelta(days=3),
                "operacao": None,
                "orgao": None,
                "alvara": None,
                "municipio": "Goiânia",
                "tpi": None,
                "inscricao_imobiliaria": None,
                "servico": CONFIG_DATA["servicos_sanitarios"][1],
                "taxa": "R$ 350,00",
                "notificacao": CONFIG_DATA["notificacoes_sanitarias"][2],
                "data_val": date.today() + timedelta(days=180),
            },
        ],
    )

    contatos_table = sa.table(
        "contatos",
        sa.column("contato", sa.String),
        sa.column("municipio", sa.String),
        sa.column("telefone", sa.String),
        sa.column("whatsapp", sa.String),
        sa.column("email", sa.String),
        sa.column("categoria", categoria_enum),
    )

    op.bulk_insert(
        contatos_table,
        [
            {
                "contato": "Fiscalização Municipal",
                "municipio": "Anápolis",
                "telefone": "(62) 99999-0001",
                "whatsapp": "SIM",
                "email": "fiscalizacao@anapolis.go.gov.br",
                "categoria": CONFIG_DATA["categorias_contato"][1],
            },
            {
                "contato": "Vigilância Sanitária",
                "municipio": "Goiânia",
                "telefone": "(62) 98888-0002",
                "whatsapp": "SIM",
                "email": "visa@goiania.go.gov.br",
                "categoria": CONFIG_DATA["categorias_contato"][3],
            },
        ],
    )

    modelos_table = sa.table(
        "modelos",
        sa.column("modelo", sa.Text),
        sa.column("descricao", sa.String),
        sa.column("utilizacao", sa.String),
    )

    op.bulk_insert(
        modelos_table,
        [
            {
                "modelo": "Prezados, lembramos que a licença sanitária expira em breve.",
                "descricao": "Aviso de renovação",
                "utilizacao": "WhatsApp",
            },
            {
                "modelo": "Favor enviar o comprovante de pagamento da taxa de funcionamento.",
                "descricao": "Cobrança taxa",
                "utilizacao": "E-mail",
            },
        ],
    )

    for sequence in (
        "empresas_id_seq",
        "licencas_id_seq",
        "taxas_id_seq",
        "processos_id_seq",
        "contatos_id_seq",
        "modelos_id_seq",
    ):
        table_name = sequence.split("_id_seq")[0]
        op.execute(
            sa.text(
                f"SELECT setval(:seq, COALESCE((SELECT MAX(id) FROM {table_name}), 0), true)"
            ).bindparams(seq=sequence)
        )


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS v_alertas_vencendo_30d"))
    op.execute(sa.text("DROP VIEW IF EXISTS v_processos_resumo"))
    op.execute(sa.text("DROP VIEW IF EXISTS v_taxas_status"))
    op.execute(sa.text("DROP VIEW IF EXISTS v_licencas_status"))
    op.execute(sa.text("DROP VIEW IF EXISTS v_empresas"))

    op.drop_index("idx_processos_prazo", table_name="processos")
    op.drop_index("idx_processos_situacao", table_name="processos")
    op.drop_index("idx_processos_empresa_tipo", table_name="processos")
    op.drop_table("processos")

    op.drop_index("idx_taxas_status", table_name="taxas")
    op.drop_index("idx_taxas_empresa_tipo", table_name="taxas")
    op.drop_table("taxas")

    op.drop_index("idx_licencas_validade", table_name="licencas")
    op.drop_index("idx_licencas_empresa_tipo", table_name="licencas")
    op.drop_table("licencas")

    op.drop_index("idx_modelos_utilizacao", table_name="modelos")
    op.drop_table("modelos")

    op.drop_index("idx_contatos_categoria", table_name="contatos")
    op.drop_table("contatos")

    op.drop_index("idx_empresas_municipio", table_name="empresas")
    op.drop_table("empresas")

    bind = op.get_bind()
    for enum_type in (
        build_enum("categorias_contato"),
        build_enum("notificacoes_sanitarias"),
        build_enum("servicos_sanitarios"),
        build_enum("alvaras_funcionamento"),
        build_enum("orgaos_diversos"),
        build_enum("operacoes_diversos"),
        build_enum("situacao_processos"),
    ):
        enum_type.drop(bind, checkfirst=True)
