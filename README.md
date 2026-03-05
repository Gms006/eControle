# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para operacao de empresas, licencas/certidoes, taxas e processos.

## Status atual do projeto (2026-03-04)

- S0 a S7: concluidos.
- S8: concluido (mirror local + sync CertHub + health de certificados).
- S9+: planejado.
- Feature adicional entregue: bulk sync ReceitaWS DEV-only com job e progresso.

Arquivos de acompanhamento:
- `PLANO_DESENVOLVIMENTO.md`
- `ESTRUTURA_REPO.md`

## Stack e portas

- Frontend (Vite): `5174`
- API (FastAPI): `8020`
- Postgres (host -> container): `5434 -> 5432`
- Redis (host -> container): `6381 -> 6379`

## Pre-requisitos

- Python 3.10+
- Node 18+
- Docker Desktop

## Setup rapido (dev)

```bash
docker compose -f infra/docker-compose.yml up -d
python -m pip install -r requirements.txt
cd backend
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8020
```

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

## Variaveis de ambiente

Use `.env.example` (raiz) como base.

Campos principais:
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `SECRET_KEY` (obrigatorio fora de `ENV=dev`)
- `SEED_ENABLED`, `SEED_ORG_NAME`, `MASTER_EMAIL`, `MASTER_PASSWORD`, `MASTER_ROLES`
- `RECEITAWS_MIN_INTERVAL_SECONDS` (default `20`)
- `RECEITAWS_RATE_LIMIT_BACKOFF_SECONDS` (default `60`)
- CertHub / Certificados (S8):
  - `CERTHUB_BASE_URL`
  - `CERTHUB_API_TOKEN` (opcional, dependendo do CertHub)
  - `CERTHUB_CERTS_LIST_URL_TEMPLATE` (ex.: `https://certhub.local/api/v1/orgs/{org_id}/certificates`)
  - `CERTHUB_AUTH_LOGIN_URL` (opcional, para login automatico quando nao houver `CERTHUB_API_TOKEN`)
  - `CERTHUB_EMAIL` (opcional, usado com `CERTHUB_AUTH_LOGIN_URL`)
  - `CERTHUB_PASSWORD` (opcional, usado com `CERTHUB_AUTH_LOGIN_URL`)
  - `CERTHUB_VERIFY_TLS` (default `true`)
  - `CERTHUB_CA_BUNDLE` (opcional, caminho do CA bundle para TLS interno)
  - `CERT_MIRROR_UPDATE_COMPANY_PROFILES` (default `true`)
- Frontend (deep link CertHub):
  - `VITE_CERTHUB_BASE_URL`
  - `VITE_CERTHUB_CERTS_PATH` (default sugerido: `/certificados`)

## Endpoints principais (API v1)

Base: `http://localhost:8020/api/v1`

- Auth: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Orgs: `/orgs/current`, `/orgs/list`
- Companies:
  - `/companies` (CRUD + listagem)
  - `/companies/composite` (criacao composta company + profile + licencas/taxas opcionais)
  - `/companies/municipios`
- Company Profile: `/profiles`
- Licencas: `/licencas`
- Taxas: `/taxas` (inclui patch de envio)
- Processos: `/processos` (listagem + CRUD)
- Situacoes de processos: `/processos/situacoes`
- Alertas: `/alertas`, `/alertas/tendencia`
- Certificados:
  - `GET /certificados` (lista do mirror)
  - `POST /certificados/sync` (ADMIN|DEV)
  - `GET /certificados/health`
- Lookups: `/lookups/receitaws/{cnpj}`
- Meta: `/meta/enums`
- Grupos: `/grupos`
- Admin usuarios: `/admin/users`
- Ingest (DEV only): `/ingest/run`, `/ingest/licences`, `/ingest/taxes`, `/ingest/processes`
- ReceitaWS bulk sync (DEV only):
  - `POST /dev/receitaws/bulk-sync/start`
  - `GET /dev/receitaws/bulk-sync/active`
  - `GET /dev/receitaws/bulk-sync/{run_id}`
  - `POST /dev/receitaws/bulk-sync/{run_id}/cancel`

Healthchecks:
- `GET /healthz`
- `GET /api/v1/worker/health`

## Ingest S7 (DEV only)

Script oficial:

```powershell
$env:ECONTROLE_EMAIL="seu_email"
$env:ECONTROLE_PASSWORD="sua_senha"
.\scripts\s7_validate_ingest.ps1
```

## ReceitaWS bulk sync (DEV only)

- Atualiza empresas ativas em lote via ReceitaWS com rate limit (3/min).
- Exige confirmacao por senha.
- Possui modos de seguranca:
  - `dry_run` (default on, nao grava no banco)
  - `only_missing` (default on, nao sobrescreve campo preenchido)
- Frontend:
  - janela de progresso com barra e resumo
  - minimizavel
  - fechar pede confirmacao e cancela run
  - se ja houver run ativo, menu retoma o run existente

## Testes

Backend (unit/integration):

```bash
cd backend
pytest -q
```

E2E API (HTTP real):

```bash
pytest -m e2e tests_e2e/api -q
```

E2E full (infra + backend + portal):

```powershell
$env:ECONTROLE_EMAIL="seu_email"
$env:ECONTROLE_PASSWORD="sua_senha"
.\scripts\e2e_run_full.ps1
```

Portal E2E Playwright:

```bash
cd frontend
npm run test:e2e
```

## Estrutura do repositorio

- `backend/`: FastAPI + SQLAlchemy + Alembic
- `frontend/`: React + Vite + Playwright
- `infra/`: `docker-compose.yml` (Postgres + Redis)
- `docs/`: baseline, contratos e artefatos de sprints
- `scripts/`: automacoes de ingest e E2E
- `tests_e2e/api/`: testes E2E da API

## Integracoes

- CertHub: espelho read-only de certificados (S8 concluido).
- Scribere: previsto para exports read-only (S9).

## Licenca

Uso interno (Neto Contabilidade).
