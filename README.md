# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para operacao de empresas, licencas/certidoes, taxas e processos.

## Status atual do projeto (2026-03-03)

- S0 a S7: concluidos.
- S8: iniciado parcialmente (endpoint de certificados existe, mas ainda sem sincronizacao CertHub; retorno atual vazio).
- S9+: planejado.

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
- Certificados: `/certificados` (placeholder atual, sem sync)
- Lookups: `/lookups/receitaws/{cnpj}`
- Meta: `/meta/enums`
- Grupos: `/grupos`
- Admin usuarios: `/admin/users`
- Ingest (DEV only): `/ingest/run`, `/ingest/licences`, `/ingest/taxes`, `/ingest/processes`

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

- CertHub: previsto como espelho read-only para certificados (S8 em andamento).
- Scribere: previsto para exports read-only (S9).

## Licenca

Uso interno (Neto Contabilidade).
