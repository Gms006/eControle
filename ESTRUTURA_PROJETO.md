# Estrutura do Projeto eControle

Mapa rápido das principais pastas e responsabilidades. Detalhes de execução estão no [`README.md`](README.md) e no [`GUIA_SETUP.md`](GUIA_SETUP.md).

```
eControle/
├── backend/                        # Backend FastAPI + ETL + integrações
│   ├── main.py                     # API v1 multi-tenant (uvicorn backend.main:app)
│   ├── api.py                      # API legada baseada em planilha
│   ├── app/                        # Código da API v1 (rotas, deps, schemas, serviços)
│   │   ├── api/v1/                 # Routers e endpoints
│   │   ├── core/                   # Configurações e carregamento do config.yaml
│   │   ├── db/                     # Sessão SQLAlchemy
│   │   └── deps/                   # Autenticação JWT + contexto multi-tenant
│   ├── db/                         # Modelos SQLAlchemy e enums
│   ├── migrations/                 # Alembic (schema, staging e views)
│   ├── etl/                        # Extract/Transform/Load + CLI Typer
│   ├── services/                   # Integrações com planilha de certificados e utilidades
│   ├── cnds/, caes/                # Automação Playwright de CND/CAE
│   ├── routes_certificados.py      # Rotas auxiliares do legado
│   ├── scripts/dev/mint_jwt.py     # Gerador de tokens JWT para testes
│   └── requirements.txt            # Dependências Python (API v1, ETL e legado)
├── etl/__main__.py                 # Wrapper para `python -m etl`
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

1. **Planilhas** (`.xlsm`) são mapeadas por `backend/config.yaml` (sheet_names, table_names, aliases e enums).
2. **ETL** (`python -m etl import ...`) normaliza cabeçalhos, datas, CNPJ e enums e grava staging (`stg_*`) antes de aplicar UPSERT no schema principal.
3. **API v1** (`backend/main.py`) lê do PostgreSQL, injeta `app.current_org` por requisição e aplica RBAC via `Role` em `app/deps/auth.py`.
4. **Frontend** (`frontend/`) consome `/api/v1/*` usando `VITE_API_URL` ou o proxy local do Vite.
5. **Legado** (`backend/api.py`) continua disponível para leituras diretas da planilha e para servir PDFs gerados pelas automações.

## Convenções

- Planilhas reais ficam fora do repositório; use uma pasta local `data/`.
- Configure variáveis sensíveis no `.env` do backend (API v1/ETL) ou no `.env` do legado conforme o fluxo em uso.
- Playwright Chromium deve ser instalado manualmente: `python -m playwright install chromium`.
