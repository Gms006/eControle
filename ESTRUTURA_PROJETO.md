# Estrutura do Projeto eControle

Mapa rápido das principais pastas e responsabilidades. Detalhes de execução estão no [`README.md`](README.md) e no [`GUIA_SETUP.md`](GUIA_SETUP.md).

```
eControle/
├── backend/                        # Backend FastAPI + integrações
│   ├── main.py                     # API v1 multi-tenant (uvicorn backend.main:app)
│   ├── api.py                      # API legada baseada em planilha (opcional)
│   ├── app/                        # Código da API v1 (rotas, deps, schemas, serviços)
│   │   ├── api/v1/                 # Routers e endpoints (views/tabelas Postgres)
│   │   ├── core/                   # Configurações e carregamento do config.yaml
│   │   ├── db/                     # Sessão SQLAlchemy + enums
│   │   └── deps/                   # Autenticação JWT + contexto multi-tenant
│   ├── db/                         # Modelos SQLAlchemy
│   ├── migrations/                 # Alembic (schema, enums, views, índices)
│   ├── etl/                        # Extract/Transform/Load + CLI Typer (planilhas, opcional)
│   ├── services/                   # Integrações com planilha de certificados e utilidades
│   ├── cnds/, caes/                # Automação Playwright de CND/CAE
│   ├── routes_certificados.py      # Rotas auxiliares do legado
│   ├── scripts/dev/mint_jwt.py     # Gerador de tokens JWT para testes
│   └── requirements.txt            # Dependências Python (API v1, ETL e legado)
├── etl/__main__.py                 # Wrapper para `python -m etl` (legado)
├── frontend/                       # Aplicação React 18 + Vite + Tailwind
│   ├── src/features/               # Telas (empresas, licenças, taxas, processos, etc.)
│   ├── src/lib/                    # Helpers de API e formatação
│   ├── src/providers/              # Providers globais (toast, tema)
│   └── package.json                # Dependências npm
├── tests/                          # Pytest (API v1, ETL e smoke do legado)
├── README.md                       # Visão geral e operação rápida
├── GUIA_SETUP.md                   # Passo a passo de instalação e execução
└── ESTRUTURA_PROJETO.md            # Este mapa
```

## Fluxos principais

1. **Banco de dados** (PostgreSQL) é criado/sincronizado por Alembic: tabelas multi-tenant (`org_id`), enums, funções utilitárias, views (`v_empresas`, `v_licencas_status`, `v_taxas_status`, `v_processos_resumo`, `v_alertas_vencendo_30d`, `v_grupos_kpis`, `v_contatos_uteis`, `v_modelos_uteis`) e índices de busca normalizada (`immutable_unaccent`).
2. **API v1** (`backend/main.py`) injeta `app.current_org` por requisição, aplica RBAC via `Role` em `app/deps/auth.py` e expõe `/api/v1/*` (empresas, licenças, taxas, processos, KPIs, alertas, municípios, úteis, stub de agendamentos) consumindo views/tabelas reais.
3. **Frontend** (`frontend/`) consome `/api/v1/*` usando `VITE_API_URL` ou o proxy local do Vite.
4. **Legado opcional**: ETL e `backend/api.py` permitem ingestão/leitura direta de planilhas `.xlsm` e automações de CND/CAE.

## Convenções

- Alembic é o caminho suportado para criar/atualizar o schema; rode `alembic upgrade head` após atualizar o repositório.
- Planilhas reais ficam fora do repositório; use uma pasta local `data/` apenas se recorrer ao legado/ETL.
- Configure variáveis sensíveis no `.env` do backend (API v1) ou em um `.env` separado para o legado, conforme o fluxo em uso.
- Playwright Chromium deve ser instalado manualmente: `python -m playwright install chromium`.
