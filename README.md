# eControle

Plataforma interna para acompanhar empresas, licenças, taxas, processos administrativos, certificados digitais e materiais de apoio. Os dados são persistidos em PostgreSQL, servidos por uma API FastAPI multi-tenant e consumidos pelo frontend React. Um ETL idempotente normaliza planilhas CSV legadas quando necessário.

## Visão geral da arquitetura

- **API FastAPI (`backend/main.py`)**: aplica contexto multi-tenant com `app.current_org`, middleware CORS e rotas `/api/v1/*` que exigem JWT. Healthcheck em `/healthz` e depuração do GUC em `/__debug/guc`.
- **ETL (`python -m etl`)**: CLI Typer que lê contratos em `backend/config.yaml`, normaliza dados (empresas, licenças, taxas, processos, certificados e agendamentos) e executa UPSERT idempotente no PostgreSQL.
- **Automação CND/CAE**: módulos em `backend/cnds/` e `backend/caes/` usam Playwright/Chromium para emissão e agendamento de documentos fiscais.
- **Frontend (`frontend/`)**: React 18 + Vite + Tailwind com proxy local para `http://localhost:8000/api`. A URL do backend pode ser ajustada via `VITE_API_URL`.

Arquitetura resumida:

```
CSV (opcional) ──▶ backend/etl ──▶ PostgreSQL ──▶ backend/main.py (FastAPI v1)
                                                 │
                                                 ▼
                                            frontend (React 18 + Vite)
```

## Uso do repositório

- Consulte o [`GUIA_SETUP.md`](GUIA_SETUP.md) para o passo a passo completo de instalação, configuração das variáveis de ambiente e execução de API/ETL/frontend.
- Veja o [`ESTRUTURA_PROJETO.md`](ESTRUTURA_PROJETO.md) para o mapa de diretórios e responsabilidades.
- Referência de integrações e fluxos específicos está em arquivos auxiliares como `FLUXO_INTEGRACOES.md` e `ATALHOS.md`.

## Pontos de entrada rápidos

- API v1: `uvicorn backend.main:app --reload` (requer `.env` com `DATABASE_URL` e `JWT_SECRET`).
- ETL: `python -m etl import caminho/dados.csv --dry-run|--apply` (usa o mesmo `.env` do backend).
- Frontend: `npm run dev` em `frontend/` (proxy `/api` → `http://localhost:8000`).

## Testes automatizados

- Testes Python ficam em `tests/` e cobrem autenticação JWT, filtros da API e idempotência do ETL.
- Execute com `pytest` na raiz do repositório após configurar o `.env` do backend ou usar o SQLite de testes.

Projeto interno. Consulte o time responsável antes de distribuir.
