# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para operacao de empresas, licencas/certidoes, taxas e processos.

## Status atual do projeto (2026-03-13)

- S0 a S7: concluidos.
- S8: concluido (mirror local + sync CertHub + health + webhook receptor CertHub).
- S10: em andamento (S10.1a + S10.1b + S10.2 concluídos; S10.3 em andamento).
- S9/S11/S12: planejados.
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
- `EMPRESAS_ROOT_DIR` (default `G:/EMPRESAS`) para upload/watcher de licencas
- CertHub / Certificados (S8):
  - `CERTHUB_BASE_URL`
  - `CERTHUB_API_TOKEN` (opcional, dependendo do CertHub)
  - `CERTHUB_CERTS_LIST_URL_TEMPLATE` (ex.: `https://certhub.local/api/v1/orgs/{org_id}/certificates`)
  - `CERTHUB_AUTH_LOGIN_URL` (opcional, para login automatico quando nao houver `CERTHUB_API_TOKEN`)
  - `CERTHUB_EMAIL` (opcional, usado com `CERTHUB_AUTH_LOGIN_URL`)
  - `CERTHUB_PASSWORD` (opcional, usado com `CERTHUB_AUTH_LOGIN_URL`)
  - `CERTHUB_VERIFY_TLS` (default `true`)
  - `CERTHUB_CA_BUNDLE` (opcional, caminho do CA bundle para TLS interno)
  - `CERTHUB_WEBHOOK_TOKEN` (token Bearer fixo validado no endpoint de webhook)
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
  - `POST /licencas/upload-bulk` (ADMIN|DEV)
  - `POST /licencas/detect` (ADMIN|DEV, analisa somente nomes de arquivos)
  - `POST /licencas/scan-full` (ADMIN|DEV, scan manual em lote com run/progresso)
- Taxas: `/taxas` (inclui patch de envio)
- Processos: `/processos` (listagem + CRUD)
  - criacao de `DIVERSOS` com empresa nao cadastrada permitida com `company_id=null` + `company_cnpj` + `company_razao_social`
- Situacoes de processos: `/processos/situacoes`
- Alertas: `/alertas`, `/alertas/tendencia`
- Certificados:
  - `GET /certificados` (lista do mirror)
  - `POST /certificados/sync` (ADMIN|DEV)
  - `GET /certificados/health`
- Integracoes CertHub (webhook server-to-server):
  - `POST /integracoes/certhub/webhook` (auth por `Authorization: Bearer <CERTHUB_WEBHOOK_TOKEN>`)
  - modos suportados: `upsert`, `delete`, `full`
- Lookups: `/lookups/receitaws/{cnpj}` (provedor primario ReceitaWS com fallback automatico para BrasilAPI)
- Meta: `/meta/enums`
- Grupos: `/grupos`
- Admin usuarios: `/admin/users`
- Ingest (DEV only): `/ingest/run`, `/ingest/licences`, `/ingest/taxes`, `/ingest/processes`
- ReceitaWS bulk sync (DEV only):
  - `POST /dev/receitaws/bulk-sync/start`
  - `GET /dev/receitaws/bulk-sync/active`
  - `GET /dev/receitaws/bulk-sync/{run_id}`
  - `POST /dev/receitaws/bulk-sync/{run_id}/cancel`
- Worker (read-only status):
  - `GET /worker/health` (ADMIN|DEV|VIEW, inclui `jobs_supported` e `watchers_supported`)
  - `GET /worker/jobs/{job_id}` (ADMIN|DEV|VIEW, suporta `receitaws_bulk_sync` e `licence_scan_full`)

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

## Watcher de licencas (S10.1b)

- Comando fora do `uvicorn`: `python -m app.worker.watchers`
- Modo loop: `python -m app.worker.watchers --loop --interval-seconds 15`
- Resolução empresa -> pasta usa `companies.fs_dirname` (campo do portal: `Apelido (Pasta)`) para montar `G:/EMPRESAS/{PASTA}/Societário/Alvarás e Certidões`.
- Regras MVP:
  - ignora arquivos `.tmp`
  - parseia nomes padrao:
    - `{LABEL_TIPO} - Val {DD.MM.AAAA}.{ext}`
    - `{LABEL_TIPO} - Definitivo.{ext}`
  - labels suportados: `Alvará Bombeiros`, `Alvará Vig Sanitária`, `Alvará Funcionamento`, `Alvará Funcionamento - Condicionado`, `Alvará Funcionamento - Provisório`, `Uso do Solo`, `Licença Ambiental`, `Dispensa Sanitária`, `Dispensa Ambiental`
  - prioridade por tipo logico quando houver mais de um arquivo: `Definitivo > maior validade`
  - dedupe por hash em `licence_file_events`
  - projeta validade/status em `company_licences`
  - hierarquia por grupo: `Definitivo > maior validade`
    - SANITARIA: `Alvará Vig Sanitária` x `Dispensa Sanitária`
    - AMBIENTAL: `Licença Ambiental` x `Dispensa Ambiental`
  - resolução de pasta por unidade:
    - `{Municipio} - Matriz|Filial`
    - `Matriz|Filial`
    - `{Municipio}/Matriz|Filial`
    - fallback para base apenas quando não há layout estruturado

## Upload assistido de licencas (S10.2)

- Na tela de Licencas, ADMIN/DEV abre `Atualizar licenças` (dropdown).
- Ações:
  - `Nova Licença`: fluxo assistido de upload já existente.
  - `Scan Completo`: dispara scan manual em lote (`POST /api/v1/licencas/scan-full`) e acompanha status por `worker/jobs`.
- Ao selecionar arquivos, o frontend chama `POST /api/v1/licencas/detect`.
- A deteccao sugere grupo/tipo/validade/nome canonico com confianca e avisos.
- O usuario confirma/corrige cada arquivo no drawer antes do envio final.
- O envio final continua no endpoint existente `POST /api/v1/licencas/upload-bulk`.
- Perfil VIEW nao visualiza botoes de upload/deteccao.
- Se houver layout estruturado de subpastas e a pasta esperada da unidade não existir, o upload falha com erro orientado.

### Normalizacao de licencas (S10.2)

- `company_licences` possui colunas `DATE` por documento: `*_valid_until`.
- Status em colunas de licença ficam apenas canônicos (sem sufixos `*_val_*`).
- Evidências continuam em `raw.validade_*` e `raw.validade_*_br`.

## Entregas adicionais pos-S10.2

- Processos `DIVERSOS` para empresa nao cadastrada:
  - backend valida regras e persiste flag em `raw.empresa_nao_cadastrada`
  - frontend (`Novo Processo`) exibe checkbox `Empresa nao cadastrada` com validacao obrigatoria de CNPJ/Razao Social
- Frontend filtra empresas inativas em todas as abas de dominio:
  - licencas, taxas, processos e certificados mostram apenas empresas ativas
  - excecao mantida para processos `DIVERSOS` com empresa nao cadastrada
- Lookups CNPJ com resiliencia:
  - endpoint tenta ReceitaWS e, em falha temporaria, usa BrasilAPI automaticamente

## Validacao S10.2 (executada em 2026-03-11)

- `pytest -q backend/tests/test_licencas_detect.py backend/tests/test_licencas_upload_bulk.py backend/tests/test_licence_watcher.py backend/tests/test_worker_endpoints.py backend/tests/test_licence_migration_backfill.py`
  - resultado: `19 passed`
- `pytest -q backend/tests/test_lookups_receitaws.py backend/tests/test_processes_canonical.py`
  - resultado: `6 passed`

## S10.3 - Motor de Classificação e Priorização por CNAE (fases 1 e 2 backend)

- Fase 1 (estrutura):
  - tabela `cnae_risks` para classificação versionada por CNAE;
  - snapshot de score em `company_profiles`:
    - `risco_consolidado`
    - `score_urgencia`
    - `score_status`
    - `score_updated_at`;
  - campos expostos em responses do backend.
- Fase 2 (motor + recálculo backend):
  - serviço central: `backend/app/services/company_scoring.py`;
  - cálculo MVP por CNAE mapeado + vencimentos de licenças;
  - recálculo automático integrado em:
    - `PATCH /companies/{id}` (alterações de profile/CNAE);
    - `POST /companies/composite`;
    - ingest de profiles;
    - bulk sync ReceitaWS (somente quando mudanças afetam score);
    - `PATCH /licencas/{id}/item`;
    - watcher de licenças (somente quando projeção muda).
- Decisões de modelagem:
  - CNAEs permanecem em `company_profiles` (`cnaes_principal` e `cnaes_secundarios`);
  - `companies` não vira fonte de verdade de CNAE;
  - `cnae_risks` é tabela dedicada para motor futuro.
- Seed inicial:
  - arquivo versionado: `backend/seeds/cnae_risks.seed.csv`;
  - carga manual idempotente por script: `python backend/scripts/load_cnae_risks_seed.py`.
- Testes backend adicionados:
  - `backend/tests/test_company_scoring.py`.
- Operacionalização (backfill inicial):
  - script one-shot: `python backend/scripts/backfill_company_scores.py`;
  - suporta `--org-id`, `--limit`, `--batch-size` e `--dry-run`;
  - processa `company_profiles` existentes e recalcula snapshot via `recalculate_company_score`.
- Ainda pendente:
  - uso do score no frontend e cenários E2E de score.

### Backfill inicial dos snapshots de score (S10.3)

- Execução completa:
  - `python backend/scripts/backfill_company_scores.py`
- Execução limitada:
  - `python backend/scripts/backfill_company_scores.py --limit 10`
- Execução por organização:
  - `python backend/scripts/backfill_company_scores.py --org-id <ORG_ID>`
- Simulação sem persistir:
  - `python backend/scripts/backfill_company_scores.py --dry-run --limit 10`

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

## Webhook CertHub (S8)

- Rota: `POST /api/v1/integracoes/certhub/webhook`
- Auth: Bearer token fixo (`CERTHUB_WEBHOOK_TOKEN`), sem JWT de usuario.
- Payload:
  - `mode: upsert | delete | full`
  - `org_slug`
  - `certificates` (quando `upsert`/`full`)
  - `deleted_cert_ids` (quando `delete`)
- Comportamento:
  - resolve org por `org_slug`
  - `upsert`: upsert no mirror
  - `delete`: remove por `cert_id`
  - `full`: upsert + reconciliacao por `sha1_fingerprint`
  - guard de seguranca: `full` com payload vazio e ignorado (sem wipe)

## Licenca

Uso interno (Neto Contabilidade).
