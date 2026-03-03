# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referencia: 2026-03-03

## Visao geral

Status global: projeto operacional para dominio core e ingest JSON (S7), com integracao CertHub ainda incompleta.

- Concluido: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Em andamento parcial: S8
- Pendente: S9, S10, S11, S12

## S0 - Kickoff e baseline

Status: concluido (2026-02-11)

Entregues:
- `docs/BASELINE_V1.md`
- `docs/REUSE_FRONTEND_MAP.md`
- `docs/INTEGRATION_CONTRACTS.md`
- `docs/RISKS_AND_DECISIONS_S0.md`

## S1 - Estrutura de repo + infra Docker

Status: concluido (2026-02-12)

Entregues:
- Monorepo padrao (`backend/`, `frontend/`, `infra/`, `docs/`, `scripts/`)
- `infra/docker-compose.yml` com Postgres e Redis
- Portas sem conflito: `5434`, `6381`, `8020`, `5174`
- Healthchecks: `/healthz`, `/api/v1/worker/health`

## S2 - Core backend (config/db/alembic/test harness)

Status: concluido (2026-02-18)

Entregues:
- `backend/app/core/*`, `backend/app/db/*`, logging e config
- Alembic ativo com migracoes incrementais
- Base de testes com pytest

## S3 - Auth + RBAC

Status: concluido (2026-02-18)

Entregues:
- `/api/v1/auth/login`, `/refresh`, `/logout`, `/me`
- RBAC (`DEV`, `ADMIN`, `VIEW`)
- Seed de org e usuario master por env

## S4 - Org context / multi-tenant

Status: concluido (2026-02-19)

Entregues:
- Header opcional `X-Org-Id` / `X-Org-Slug` com validacao
- `/api/v1/orgs/current`, `/api/v1/orgs/list`
- Isolamento por `org_id`

## S5 - Dominio core backend

Status: concluido (2026-02-19)

Entregues:
- CRUD de empresas, licencas, taxas e processos
- Endpoints de suporte para operacao do front
- Testes cobrindo auth/rbac/core

## S6 - Frontend reaproveitado

Status: concluido (2026-02-23)

Entregues:
- Frontend em React/Vite operacional
- Login real integrado ao backend
- Navegacao por abas do dominio core

## S6.1 - Admin users API

Status: concluido (2026-02-23)

Entregues:
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{user_id}`
- Regras de seguranca (ex.: nao desativar o proprio usuario)

## S6.2 - Operacao completa no portal

Status: concluido incrementalmente (2026-02-27)

Entregues:
- Fluxos de criar/editar empresas e processos no frontend
- Drawer lateral padronizado para formularios
- Normalizacao canonica de status e municipios
- Endpoints adicionais:
  - `/api/v1/lookups/receitaws/{cnpj}`
  - `/api/v1/meta/enums`
  - `/api/v1/companies/municipios`
- Migracoes de normalizacao e ajuste de schema ate `20260227_0013`

## S7 - Ingest JSON (substitui planilha)

Status: concluido (base em 2026-02-24, evolucao 2026-02-25)

Entregues:
- Ingest agregado: `POST /api/v1/ingest/run`
- Ingest por dataset:
  - `POST /api/v1/ingest/licences`
  - `POST /api/v1/ingest/taxes`
  - `POST /api/v1/ingest/processes`
- Tracking em `ingest_runs` com hash/stats/status
- Idempotencia validada em testes e script oficial
- Hardening UTF-8 em fluxo Windows/PowerShell

## S8 - Integracao CertHub (espelho de certificados)

Status: em andamento parcial (2026-03-03)

Implementado hoje:
- Endpoint base `GET /api/v1/certificados` com auth + org context

Pendente para concluir S8:
- Persistencia de mirror local de certificados
- Endpoint de sync com CertHub
- Indicadores no dashboard de vencidos/proximos
- Deep link operacional de "Instalar" com dados reais do mirror

## S9 - Integracao Scribere (exports read-only)

Status: pendente

Objetivo:
- Expor exports governados no Scribere via API do eControle (somente leitura)

## S10 - Workers/Jobs/Watchers

Status: pendente

Objetivo:
- Jobs de sync/notificacao/automacoes com anti-duplicacao e observabilidade

## S11 - Polimento de paridade v1

Status: pendente

Objetivo:
- Filtros, paginacao, ordenacao, performance, refinamentos de UX

## S12 - Hardening e go-live

Status: pendente

Objetivo:
- Runbooks finais, testes de regressao ampliados e ajustes de seguranca/operacao

## Validacao operacional atual (recomendada)

```powershell
docker compose -f infra/docker-compose.yml up -d
python -m pip install -r requirements.txt

cd backend
alembic upgrade head
pytest -q
cd ..

$env:ECONTROLE_EMAIL="seu_email"
$env:ECONTROLE_PASSWORD="sua_senha"
.\scripts\s7_validate_ingest.ps1
.\scripts\e2e_run_full.ps1
```
