# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para operacao de empresas, licencas/certidoes, taxas e processos.

## Status atual do projeto (2026-05-04)

- S0 a S7: concluidos.
- S8: concluido (mirror local + sync CertHub + health + webhook receptor CertHub).
- S10: em andamento (S10.1a + S10.1b + S10.2 concluÃ­dos; S10.2a/Patch 1 regulatÃ³rio entregue com modelagem explÃ­cita de alvarÃ¡/complexidade sanitÃ¡ria/endereÃ§o; S10.3 fase 3 concluÃ­da + S10.3 parcial com calibragem de catÃ¡logo e base de atualizaÃ§Ã£o assistida em andamento; S10.4 Notification Center MVP entregue; S10.5/Fase C de notificaÃ§Ãµes operacionais entregue).
- S11: em andamento (S11.1 Copiloto eControle migrado para Gemini 2.5 Flash com fallback Ollama opcional; S11.2 Dashboard Views entregue; S11.3 Cockpit de Automacoes entregue).
- S9/S12: planejados.
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
- Copiloto eControle (S11.1):
  - `COPILOT_PROVIDER` (default `gemini`)
  - `COPILOT_PROVIDER_MODEL` (default `gemini-2.5-flash`)
  - `COPILOT_PROVIDER_TIMEOUT_SECONDS` (default `60`)
  - `GEMINI_API_KEY` (obrigatÃ³ria para provider Gemini)
  - `COPILOT_PROVIDER_ENABLE_WEB_SEARCH` (default `true`; ativa grounding de forma controlada em `DUVIDAS_DIVERSAS`)
  - `COPILOT_FALLBACK_PROVIDER` (default `ollama`)
  - `COPILOT_FALLBACK_BASE_URL` (default `http://127.0.0.1:11434`)
  - `COPILOT_FALLBACK_MODEL` (default `gemma3:4b`)
  - `COPILOT_FALLBACK_TIMEOUT_SECONDS` (default `60`)
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
  - `/companies/{id}/overview` (overview consolidado da empresa)
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
- Notificacoes:
  - `GET /notificacoes` (ADMIN|DEV|VIEW, feed por organizacao)
  - `GET /notificacoes/unread-count` (ADMIN|DEV|VIEW)
  - `POST /notificacoes/{id}/read` (ADMIN|DEV|VIEW)
  - `POST /notificacoes/scan-operacional` (ADMIN|DEV, dispara scan operacional com run)
- Certificados:
  - `GET /certificados` (lista do mirror)
  - `POST /certificados/sync` (ADMIN|DEV)
  - `GET /certificados/health`
- Integracoes CertHub (webhook server-to-server):
  - `POST /integracoes/certhub/webhook` (auth por `Authorization: Bearer <CERTHUB_WEBHOOK_TOKEN>`)
  - modos suportados: `upsert`, `delete`, `full`
- Lookups: `/lookups/receitaws/{cnpj}` (provedor primario ReceitaWS com fallback automatico para BrasilAPI)
- Copiloto eControle (read-only; ADMIN|DEV|VIEW):
  - `POST /copilot/respond`
    - categorias: `COMPANY_SUMMARY`, `DOCUMENT_ANALYSIS`, `RISK_SIMULATION`, `DUVIDAS_DIVERSAS`
    - `multipart/form-data`: `category`, `company_id` (opcional para `DUVIDAS_DIVERSAS`), `message`, `document` (opcional)
    - sem persistÃªncia automÃ¡tica: nÃ£o grava banco, nÃ£o aprova, nÃ£o atualiza score persistido, nÃ£o dispara jobs
- Dashboard Views:
  - `GET /dashboard/views`
  - `POST /dashboard/views`
  - `PATCH /dashboard/views/{view_id}`
  - `DELETE /dashboard/views/{view_id}`
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
  - `GET /worker/jobs/{job_id}` (ADMIN|DEV|VIEW, suporta `receitaws_bulk_sync`, `tax_portal_sync`, `licence_scan_full` e `notification_operational_scan`)
  - `GET /worker/snapshot` (ADMIN|DEV|VIEW, consolida ultimas runs e trilha de auditoria operacional para a tela de Automacoes)
- Relatorios:
  - `GET /relatorios/campos` (lista campos exportaveis com filtros de seguranca)
  - `POST /relatorios/exportar` (gera XLSX com campos selecionados)

Notification Center MVP (S10.4):
- persistencia em `notification_events` com dedupe por `unique(org_id, dedupe_key)`;
- feed por org (sem inbox por usuario nesta fase);
- emissao inicial ao final de jobs:
  - `licence_scan_full`
  - `receitaws_bulk_sync`
  - `tax_portal_sync`
- frontend:
  - contador de nao lidas no sino da Topbar;
  - painel com ultimas notificacoes;
  - acao de marcar como lida;
  - navegacao por `route_path` quando fornecida.

Notification Center Fase C (S10.5):
- regras operacionais automÃ¡ticas por scan:
  - `LIC_BOMBEIROS_BD5`: CERCON/Bombeiros em janela de 5 dias Ãºteis antes do vencimento;
  - `LIC_ALVARA_D30`: AlvarÃ¡ de Funcionamento em janela de 30 dias corridos;
  - `LIC_SANITARIO_D30`: AlvarÃ¡ SanitÃ¡rio em janela de 30 dias corridos;
  - `LIC_AMBIENTAL_BD30`: LicenÃ§a Ambiental em janela de 30 dias Ãºteis;
  - `PROC_STALE_BD7`: processo com 7 dias Ãºteis sem atualizaÃ§Ã£o;
  - `PROC_STALE_BD15`: processo com 15 dias Ãºteis sem atualizaÃ§Ã£o.
- referÃªncia de processo:
  - `updated_at` como fonte principal;
  - fallback em `data_solicitacao`.
- idempotÃªncia/dedupe:
  - reprocessamento nÃ£o duplica notificaÃ§Ãµes (`dedupe_key` determinÃ­stica por regra/entidade/janela).
- observabilidade:
  - novo tipo de job no worker: `notification_operational_scan`.

Rotina diÃ¡ria (agendamento externo Windows):
- abordagem oficial desta fase: **scheduler externo** chamando endpoint existente (sem scheduler embutido no backend);
- scripts operacionais:
  - `scripts/ops/run_notification_operational_scan.ps1`
  - `scripts/ops/run_notification_operational_scan.cmd`
- fluxo do script:
  1. autentica em `/api/v1/auth/login`
  2. dispara `POST /api/v1/notificacoes/scan-operacional`
  3. captura `run_id`
  4. faz polling em `GET /api/v1/worker/jobs/{run_id}` atÃ© status final
  5. retorna `exit 0` apenas em `completed`; `exit 1` em `failed`/`cancelled`/timeout/erro HTTP
- variÃ¡veis suportadas:
  - `ECONTROLE_BASE_URL` (default `http://localhost:8020/api/v1`)
  - `ECONTROLE_EMAIL`
  - `ECONTROLE_PASSWORD`
  - `ECONTROLE_SCAN_TIMEOUT_SECONDS` (default `1800`)
  - `ECONTROLE_SCAN_POLL_INTERVAL_SECONDS` (default `10`)
  - opcional: `ECONTROLE_SCAN_CONFIG_FILE` (`.env` local nÃ£o versionado, formato `KEY=VALUE`)
- log:
  - default: `%ProgramData%\eControle\logs\notification_operational_scan.log`

Exemplo de execuÃ§Ã£o manual (PowerShell):
```powershell
$env:ECONTROLE_BASE_URL="http://localhost:8020/api/v1"
$env:ECONTROLE_EMAIL="seu_email"
$env:ECONTROLE_PASSWORD="sua_senha"
$env:ECONTROLE_SCAN_TIMEOUT_SECONDS="1800"
$env:ECONTROLE_SCAN_POLL_INTERVAL_SECONDS="10"
.\scripts\ops\run_notification_operational_scan.ps1
```

Exemplo de Task Scheduler (aÃ§Ã£o):
```text
Program/script: C:\ProgramData\eControle\ops\run_notification_operational_scan.cmd
```

Rollback operacional:
- desabilitar/remover tarefa no Task Scheduler;
- remover os arquivos:
  - `scripts/ops/run_notification_operational_scan.ps1`
  - `scripts/ops/run_notification_operational_scan.cmd`
- CatÃ¡logo CNAE (ADMIN|DEV, revisÃ£o humana obrigatÃ³ria):
  - `GET /catalog/cnae-risk-suggestions`
  - `POST /catalog/cnae-risk-suggestions`
  - `PATCH /catalog/cnae-risk-suggestions/{suggestion_id}`
  - `POST /catalog/cnae-risk-suggestions/{suggestion_id}/approve`
  - `POST /catalog/cnae-risk-suggestions/{suggestion_id}/reject`
  - `POST /catalog/cnae-risk-suggestions/official/lookup`
  - `POST /catalog/cnae-risk-suggestions/official/lookup-batch`

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

## Tax Portal Sync (AnÃ¡polis)

Feature para consultar taxas no Portal do CidadÃ£o de AnÃ¡polis em modo manual ou agendado.

- job type: `tax_portal_sync`
- execuÃ§Ã£o manual: `POST /api/v1/dev/taxas/portal-sync/start`
- acompanhamento: `GET /api/v1/dev/taxas/portal-sync/{run_id}`
- run ativa: `GET /api/v1/dev/taxas/portal-sync/active`
- cancelamento: `POST /api/v1/dev/taxas/portal-sync/{run_id}/cancel`
- worker status unificado: `GET /api/v1/worker/jobs/{job_id}`

ObservaÃ§Ã£o:
- o fluxo funcional do portal foi preservado;
- a feature substitui leitura/escrita em planilha por DB (`companies` + `company_taxes`).
- backend fase atual concluÃ­da (2026-03-26): persistÃªncia real em `company_taxes`, `summary` enriquecido, `raw` com evidÃªncias da run, recÃ¡lculo de `status_taxas` e testes backend.
- Subfase B frontend concluÃ­da (2026-03-26):
  - UI na tela de Taxas (ADMIN/DEV) com gatilho manual;
  - manager visual com progresso, contadores, municÃ­pio, `dry_run`, `run_id` e Ãºltimos erros;
  - retomada automÃ¡tica de run ativa ao entrar na tela;
  - cancelamento de run ativa;
  - smoke E2E portal: `frontend/tests_e2e/portal/taxas_tax_portal_sync.smoke.spec.ts`.

## Automacoes (S11 - cockpit operacional)

- Tela dedicada no portal: `frontend/src/pages/AutomacoesScreen.jsx`.
- Integrada no shell principal (`MainApp`) como aba `automacoes`.
- Fonte de dados em tempo real:
  - `GET /api/v1/worker/snapshot`
  - `GET /api/v1/worker/health`
- Capacidades entregues:
  - visao consolidada dos jobs (`receitaws_bulk_sync`, `licence_scan_full`, `tax_portal_sync`, `notification_operational_scan`);
  - filtros por dominio, status e owner;
  - trilha de auditoria operacional baseada em eventos `job.*` de notificacoes.

## Watcher de licencas (S10.1b)

- Comando fora do `uvicorn`: `python -m app.worker.watchers`
- Modo loop: `python -m app.worker.watchers --loop --interval-seconds 15`
- ResoluÃ§Ã£o empresa -> pasta usa `companies.fs_dirname` (campo do portal: `Apelido (Pasta)`) para montar `G:/EMPRESAS/{PASTA}/SocietÃ¡rio/AlvarÃ¡s e CertidÃµes`.
- Regras MVP:
  - ignora arquivos `.tmp`
  - parseia nomes padrao:
    - `{LABEL_TIPO} - Val {DD.MM.AAAA}.{ext}`
    - `{LABEL_TIPO} - Definitivo.{ext}`
  - labels suportados: `AlvarÃ¡ Bombeiros`, `AlvarÃ¡ Vig SanitÃ¡ria`, `AlvarÃ¡ Funcionamento`, `AlvarÃ¡ Funcionamento - Condicionado`, `AlvarÃ¡ Funcionamento - ProvisÃ³rio`, `Uso do Solo`, `LicenÃ§a Ambiental`, `Dispensa SanitÃ¡ria`, `Dispensa Ambiental`
  - prioridade por tipo logico quando houver mais de um arquivo: `Definitivo > maior validade`
  - dedupe por hash em `licence_file_events`
  - projeta validade/status em `company_licences`
  - hierarquia por grupo: `Definitivo > maior validade`
    - SANITARIA: `AlvarÃ¡ Vig SanitÃ¡ria` x `Dispensa SanitÃ¡ria`
    - AMBIENTAL: `LicenÃ§a Ambiental` x `Dispensa Ambiental`
  - resoluÃ§Ã£o de pasta por unidade:
    - `{Municipio} - Matriz|Filial`
    - `Matriz|Filial`
    - `{Municipio}/Matriz|Filial`
    - fallback para base apenas quando nÃ£o hÃ¡ layout estruturado

## Upload assistido de licencas (S10.2)

- Na tela de Licencas, ADMIN/DEV abre `Atualizar licenÃ§as` (dropdown).
- AÃ§Ãµes:
  - `Nova LicenÃ§a`: fluxo assistido de upload jÃ¡ existente.
  - `Scan Completo`: dispara scan manual em lote (`POST /api/v1/licencas/scan-full`) e acompanha status por `worker/jobs`.
- Ao selecionar arquivos, o frontend chama `POST /api/v1/licencas/detect`.
- A deteccao sugere grupo/tipo/validade/nome canonico com confianca e avisos.
- O usuario confirma/corrige cada arquivo no drawer antes do envio final.
- O envio final continua no endpoint existente `POST /api/v1/licencas/upload-bulk`.
- Perfil VIEW nao visualiza botoes de upload/deteccao.
- Se houver layout estruturado de subpastas e a pasta esperada da unidade nÃ£o existir, o upload falha com erro orientado.

### Normalizacao de licencas (S10.2)

- `company_licences` possui colunas `DATE` por documento: `*_valid_until`.
- Status em colunas de licenÃ§a ficam apenas canÃ´nicos (sem sufixos `*_val_*`).
- EvidÃªncias continuam em `raw.validade_*` e `raw.validade_*_br`.

### Patch 1 regulatÃ³rio (2026-04-23)

- Novas fontes de verdade explÃ­citas:
  - `company_licences.alvara_funcionamento_kind`
  - `company_profiles.sanitary_complexity`
  - `company_profiles.address_usage_type`
  - `company_profiles.address_location_type`
- Backfill conservador:
  - `alvara_funcionamento_kind` usa `raw.source_document_kind_alvara_funcionamento` quando confiÃ¡vel;
  - fallback para `DEFINITIVO` quando `raw.source_kind_alvara_funcionamento == "definitivo"`;
  - ausÃªncia de confianÃ§a suficiente cai em `PENDENTE_REVISAO`;
  - `sanitary_complexity` e `address_location_type` iniciam em `PENDENTE_REVISAO`;
  - `address_usage_type` usa `FISCAL` apenas quando `raw.endereco_fiscal == true`.
- Watcher e upload assistido agora persistem `alvara_funcionamento_kind` explicitamente em `company_licences`, mantendo `raw` apenas como evidÃªncia complementar.
- Company drawer e ediÃ§Ã£o rÃ¡pida de licenÃ§as passam a expor os novos campos no portal.
- Regras regulatÃ³rias de score/notificaÃ§Ãµes/invalidaÃ§Ã£o por processo continuam fora deste patch.

### Patch 2 regulatÃ³rio (2026-04-23)

- ServiÃ§o central novo: `backend/app/services/licence_regulatory_rules.py`.
- Regra derivada conservadora para alvarÃ¡ de funcionamento `DEFINITIVO`:
  - identifica se a empresa possui alvarÃ¡ definitivo;
  - procura processo potencialmente invalidante com contexto forte de alteraÃ§Ã£o em prefeitura;
  - sÃ³ invalida quando `obs` traz indÃ­cio textual claro para `CNAE`, `RAZAO_SOCIAL`, `NOME_FANTASIA` ou `ENDERECO`.
- Score:
  - `company_scoring.py` deixa de classificar alvarÃ¡ definitivo vÃ¡lido como `NO_LICENCE`;
  - novos status:
    - `OK_DEFINITIVE`
    - `DEFINITIVE_INVALIDATED`
  - `alvara_funcionamento_valid_until` deixa de participar da lÃ³gica periÃ³dica quando o alvarÃ¡ Ã© `DEFINITIVO`.
- NotificaÃ§Ãµes operacionais:
  - `LIC_ALVARA_D30` passa a ser ignorada para alvarÃ¡ definitivo;
  - nova regra `LIC_DEFINITIVO_INVALIDADO` orienta solicitar novo alvarÃ¡ quando houver invalidaÃ§Ã£o conservadora.
- Overview:
  - `GET /api/v1/companies/{id}/overview` expÃµe bloco derivado `regulatory`;
  - item de licenÃ§a de funcionamento agora inclui:
    - `regulatory_status`
    - `invalidated_reasons`
    - `invalidating_process_ref`
    - `requires_new_licence_request`
- Portal:
  - `CompanyOverviewDrawer.jsx` mostra status regulatÃ³rio do alvarÃ¡ definitivo, motivos, processo relacionado e exigÃªncia de novo pedido;
  - labels de score em `EmpresasScreen.jsx` e `LicencasScreen.jsx` reconhecem `OK_DEFINITIVE` e `DEFINITIVE_INVALIDATED`.

Enums expostos em `GET /api/v1/meta/enums`:
- `alvara_funcionamento_kinds`
- `sanitary_complexities`
- `address_usage_types`
- `address_location_types`

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

## S10.3 - Motor de ClassificaÃ§Ã£o e PriorizaÃ§Ã£o por CNAE (fases 1, 2 e 3)

Status: concluÃ­da (backend + frontend + E2E portal)

- Fase 1 (estrutura):
  - tabela `cnae_risks` para classificaÃ§Ã£o versionada por CNAE;
  - snapshot de score em `company_profiles`:
    - `risco_consolidado`
    - `score_urgencia`
    - `score_status`
    - `score_updated_at`;
  - campos expostos em responses do backend.
- Fase 2 (motor + recÃ¡lculo backend):
  - serviÃ§o central: `backend/app/services/company_scoring.py`;
  - cÃ¡lculo MVP por CNAE mapeado + vencimentos de licenÃ§as;
  - recÃ¡lculo automÃ¡tico integrado em:
    - `PATCH /companies/{id}` (alteraÃ§Ãµes de profile/CNAE);
    - `POST /companies/composite`;
    - ingest de profiles;
    - bulk sync ReceitaWS (somente quando mudanÃ§as afetam score);
    - `PATCH /licencas/{id}/item`;
    - watcher de licenÃ§as (somente quando projeÃ§Ã£o muda).
- DecisÃµes de modelagem:
  - CNAEs permanecem em `company_profiles` (`cnaes_principal` e `cnaes_secundarios`);
  - `companies` nÃ£o vira fonte de verdade de CNAE;
  - `cnae_risks` Ã© tabela dedicada para motor futuro.
- Seed inicial:
  - arquivo versionado: `backend/seeds/cnae_risks.seed.csv`;
  - carga manual idempotente por script: `python backend/scripts/load_cnae_risks_seed.py`;
  - recÃ¡lculo operacional no mesmo fluxo:
    - impactados: `python backend/scripts/load_cnae_risks_seed.py --recalculate-affected`
    - completo: `python backend/scripts/load_cnae_risks_seed.py --recalculate-all`
- Testes backend adicionados:
  - `backend/tests/test_company_scoring.py`.
- OperacionalizaÃ§Ã£o (backfill inicial):
  - script one-shot: `python backend/scripts/backfill_company_scores.py`;
  - suporta `--org-id`, `--limit`, `--batch-size` e `--dry-run`;
  - processa `company_profiles` existentes e recalcula snapshot via `recalculate_company_score`.
- Fase 3 (frontend + E2E portal):
  - exibiÃ§Ã£o de `score_urgencia`, `risco_consolidado` e `score_status` na listagem de empresas;
  - filtro de risco (`Todos`, `Alto`, `MÃ©dio`, `Baixo`);
  - ordenaÃ§Ã£o por score com prioridade para maior urgÃªncia e `nulls last`;
  - labels amigÃ¡veis para risco e status;
  - tratamento defensivo para `null`;
  - placeholder CNAE `00.00-0-00` sem destaque como CNAE vÃ¡lido.
- E2E portal:
  - `frontend/tests_e2e/portal/company_scoring.spec.ts`.
- Ainda pendente:
  - curadoria fina de `cnae_risks` para calibragem de risco/peso por domÃ­nio.
  - job diÃ¡rio de recÃ¡lculo automÃ¡tico (fora do escopo atual).

### S10.3 parcial P1 (normalizaÃ§Ã£o canÃ´nica CNAE + recÃ¡lculo pÃ³s-seed)

- helper Ãºnico de normalizaÃ§Ã£o canÃ´nica de CNAE em `backend/app/core/cnae.py`;
- aplicado em:
  - `backend/app/services/company_scoring.py`
  - `backend/app/services/ingest/company_profiles.py`
  - `backend/app/services/receitaws_bulk_sync.py`
  - `backend/scripts/load_cnae_risks_seed.py`
- lookup em `cnae_risks` passa a casar formatos equivalentes (`5611201`, `56 11-2/01`, `56.11-2-01`);
- seed ganhou opÃ§Ã£o de recÃ¡lculo transacional de score:
  - `--recalculate-affected`
  - `--recalculate-all`
- placeholders invÃ¡lidos de CNAE (`00.00-0-00`, `********`, `NÃ£o informada`) passam a cair em `NO_CNAE`.

### S10.3 parcial (calibragem de catÃ¡logo CNAE)

- diagnÃ³stico confirmado: gargalo atual em catÃ¡logo achatado (`LOW/10/bootstrap`) e nÃ£o no motor;
- seed passou a incluir tiers e pesos calibrados (`LOW`, `MEDIUM`, `HIGH`) para CNAEs mais recorrentes;
- compatÃ­vel com motor atual (sem alteraÃ§Ã£o de schema);
- operaÃ§Ã£o recomendada apÃ³s editar catÃ¡logo:
  1. editar `backend/seeds/cnae_risks.seed.csv`;
  2. executar `python backend/scripts/load_cnae_risks_seed.py --recalculate-all`;
  3. validar distribuiÃ§Ã£o no banco (`risk_tier`, `base_weight`, `source`);
  4. rodar testes backend.

### S10.3 subfase - atualizaÃ§Ã£o assistida de catÃ¡logo CNAE (base segura)

- tabela de sugestÃµes: `cnae_risk_suggestions`;
- regra de seguranÃ§a: atualizaÃ§Ã£o automatizada nunca aplica direto em produÃ§Ã£o sem revisÃ£o humana;
- status do fluxo: `PENDING -> APPLIED` (com opÃ§Ã£o `REJECTED`; `APPROVED` intermediÃ¡rio interno);
- ao aprovar uma sugestÃ£o:
  - aplica em `cnae_risks` (upsert);
  - recalcula empresas afetadas pelo CNAE;
  - registra auditoria mÃ­nima via `record_audit_event`;
- fora de escopo nesta entrega:
  - scraper/web crawling;
  - aplicaÃ§Ã£o automÃ¡tica sem revisÃ£o.

### S10.3b entrega 2b - consulta de bases oficiais priorizadas para geraÃ§Ã£o automÃ¡tica de sugestÃµes `PENDING`

- novas fontes oficiais (adaptadores dedicados):
  - `CGSIM`
  - `ANVISA`
  - `ANAPOLIS` (fonte municipal oficial prioritÃ¡ria)
  - `GOIANIA` (fallback/referÃªncia municipal)
  - `CBMGO` (referÃªncia com dependÃªncia de contexto adicional)
- saÃ­da normalizada por finding (`domain`, evidÃªncia, referÃªncia, confianÃ§a, `requires_questionnaire`);
- orquestrador consulta 1 CNAE ou lote, consolida findings e cria sugestÃµes pendentes;
- ANÃPOLIS passa a ser default municipal quando nenhuma fonte municipal Ã© informada;
- GOIANIA permanece disponÃ­vel somente como fallback/referÃªncia (nÃ£o prioritÃ¡ria);
- ANVISA usa parser online com prioridade para IN 66/2020 e suporte semÃ¢ntico da RDC 153/2017;
- CGSIM usa integraÃ§Ã£o resiliente oficial (`URL principal -> /view -> Ã­ndice`) com modo semi-real rastreÃ¡vel em caso de bloqueio HTTP 403;
- CBMGO Ã© fonte contextual: nÃ£o fecha risco final sozinha por CNAE e mantÃ©m `requires_questionnaire=true` quando falta contexto de ocupaÃ§Ã£o/edificaÃ§Ã£o;
- regra mandatÃ³ria mantida: nenhuma consulta oficial aplica direto em `cnae_risks` (somente `PENDING`);
- deduplicaÃ§Ã£o: evita recriar sugestÃ£o pendente idÃªntica por CNAE+fonte+conteÃºdo.

### Backfill inicial dos snapshots de score (S10.3)

- ExecuÃ§Ã£o completa:
  - `python backend/scripts/backfill_company_scores.py`
- ExecuÃ§Ã£o limitada:
  - `python backend/scripts/backfill_company_scores.py --limit 10`
- ExecuÃ§Ã£o por organizaÃ§Ã£o:
  - `python backend/scripts/backfill_company_scores.py --org-id <ORG_ID>`
- SimulaÃ§Ã£o sem persistir:
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

Fluxo E2E recomendado (sem ampliar spec visual):
1. Rodar o backend E2E API.
2. Rodar o portal E2E existente (incluindo `frontend/tests_e2e/portal/company_scoring.spec.ts`, `frontend/tests_e2e/portal/taxas_tax_portal_sync.smoke.spec.ts`, `frontend/tests_e2e/portal/notifications_center.smoke.spec.ts` e `frontend/tests_e2e/portal/copilot_widget.smoke.spec.ts`).
3. Em cenÃ¡rios de ajuste de catÃ¡logo CNAE, executar antes:
   - `python backend/scripts/load_cnae_risks_seed.py --recalculate-affected`
4. Para validar Fase C de notificaÃ§Ãµes operacionais via API:
   - `pytest -m e2e tests_e2e/api/test_notifications_operational_scan_e2e.py -q`

Fluxo de validaÃ§Ã£o da atualizaÃ§Ã£o assistida do catÃ¡logo CNAE:
1. Rodar `pytest -q backend/tests/test_cnae_risk_suggestions.py`.
2. Rodar regressÃ£o do motor: `pytest -q backend/tests/test_company_scoring.py`.
3. Manter o fluxo E2E padrÃ£o (`tests_e2e/api` + Playwright portal) para cobertura de regressÃ£o geral.

Fluxo de validaÃ§Ã£o da consulta oficial (S10.3b entrega 2b):
1. Rodar `pytest -q backend/tests/test_cnae_official_sources.py`.
2. Rodar `pytest -q backend/tests/test_cnae_risk_suggestions.py`.
3. Rodar `pytest -q backend/tests/test_company_scoring.py`.
4. Rodar E2E API padrÃ£o: `pytest -m e2e tests_e2e/api -q`.
5. Rodar E2E portal padrÃ£o: `cd frontend && npm run test:e2e`.

ValidaÃ§Ã£o especÃ­fica do Patch 1 regulatÃ³rio:
1. `pytest -q backend/tests/test_regulatory_migration_backfill.py backend/tests/test_companies_composite.py backend/tests/test_companies_crud.py backend/tests/test_company_licences_endpoint.py backend/tests/test_licence_watcher.py backend/tests/test_company_overview.py backend/tests/test_processes_canonical.py`
2. `cd frontend && npm run test:e2e -- tests_e2e/portal/company_overview.spec.ts tests_e2e/portal/regression_drawers.spec.ts`

ValidaÃ§Ã£o especÃ­fica do Patch 2 regulatÃ³rio:
1. `pytest -q backend/tests/test_licence_regulatory_rules.py backend/tests/test_company_scoring.py backend/tests/test_notification_rules.py backend/tests/test_company_overview.py`
2. `cd frontend && npm run test:e2e -- tests_e2e/portal/company_overview.spec.ts tests_e2e/portal/regression_drawers.spec.ts`

Fluxo operacional do catÃ¡logo CNAE (S10.3 parcial):
1. Editar `backend/seeds/cnae_risks.seed.csv`.
2. Rodar `python backend/scripts/load_cnae_risks_seed.py --recalculate-all`.
3. Validar distribuiÃ§Ã£o no banco.
4. Rodar `pytest -q backend/tests/test_company_scoring.py`.

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
## Copiloto eControle (S11.1)

- Widget global no portal (canto inferior direito) com launcher flutuante, abrir/minimizar/fechar e estado persistido em `localStorage`.
- Fluxo guiado obrigatÃ³rio:
  1. escolher categoria
  2. escolher empresa (obrigatÃ³rio em `COMPANY_SUMMARY`, `DOCUMENT_ANALYSIS` e `RISK_SIMULATION`)
  3. liberar input manual e chips de exemplo
- Categorias MVP:
  - Entender empresa
  - Analisar documento
  - Simular impacto no risco
  - DÃºvidas diversas
- Regra de categoria `DÃºvidas diversas`:
  - pode perguntar sem empresa;
  - quando a pergunta depende de empresa especÃ­fica, o backend retorna `requires_company=true` e a UI volta para seleÃ§Ã£o de empresa.
  - quando a pergunta exige atualizaÃ§Ã£o normativa/fonte oficial, o backend pode usar web search/grounding no Gemini e retornar fontes clicÃ¡veis.
- Resposta estruturada por seÃ§Ãµes (resumo, evidÃªncias, pendÃªncias, impacto, prÃ³ximas aÃ§Ãµes, alertas) + aÃ§Ãµes rÃ¡pidas clicÃ¡veis.
- Regra de seguranÃ§a:
  - escopo fechado no domÃ­nio eControle;
  - feature read-only (`ADMIN`, `DEV`, `VIEW`);
  - nÃ£o persiste alteraÃ§Ãµes automaticamente.
- Refino de anÃ¡lise documental:
  - nÃ£o classifica por nome de arquivo;
  - PDF passa por extraÃ§Ã£o de texto e tentativa de renderizaÃ§Ã£o das primeiras pÃ¡ginas antes da inferÃªncia;
  - classificaÃ§Ã£o restrita ao conjunto fechado do domÃ­nio:
    - `CND_MUNICIPAL`, `CND_ESTADUAL`, `CND_FEDERAL`, `ALVARA_FUNCIONAMENTO`,
      `ALVARA_SANITARIO`, `LICENCA_AMBIENTAL`, `CERTIFICADO_BOMBEIROS`,
      `USO_DO_SOLO`, `OUTRO`, `NAO_CONCLUSIVO`;
  - hardening de prompt: sem expansÃ£o arbitrÃ¡ria de siglas, exigÃªncia de evidÃªncias e retorno `NAO_CONCLUSIVO` quando faltar base factual.

Provider principal e fallback:
- PrimÃ¡rio: Gemini 2.5 Flash (`COPILOT_PROVIDER=gemini`).
- Fallback opcional: Ollama local (`COPILOT_FALLBACK_PROVIDER=ollama`, `gemma3:4b`).
- Ordem de execuÃ§Ã£o:
  1. tenta Gemini;
  2. em falha controlada (configuraÃ§Ã£o, timeout, indisponibilidade), tenta fallback local se habilitado;
  3. se ambos falharem, retorna erro controlado no endpoint com mensagem amigÃ¡vel.

Como obter/configurar `GEMINI_API_KEY`:
1. Gerar chave no Google AI Studio/Google AI para Gemini API.
2. Configurar no `.env` local:
   - `GEMINI_API_KEY=<sua_chave>`
3. Nunca versionar a chave.

ValidaÃ§Ã£o local recomendada do Copiloto:
1. Backend:
   - `pytest -q backend/tests/test_copilot_provider.py backend/tests/test_copilot_endpoints.py`
2. Frontend E2E smoke:
   - `cd frontend && npm run test:e2e -- tests_e2e/portal/copilot_widget.smoke.spec.ts`

