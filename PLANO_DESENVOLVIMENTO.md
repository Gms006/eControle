# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referencia: 2026-05-04

## VisÃ£o geral

Status global: domÃ­nio principal operacional, ingest JSON ativo, integraÃ§Ã£o CertHub em produÃ§Ã£o interna e Stage S10 em evoluÃ§Ã£o.

- ConcluÃ­do: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- ConcluÃ­do: S8
- Entrega adicional concluÃ­da: bulk sync ReceitaWS (DEV)
- Em andamento: S10 (S10.1a + S10.1b + S10.2 concluÃ­dos; S10.3 fase 3 concluÃ­da; S10.4 Notification Center MVP concluÃ­do; S10.5 Fase C de notificaÃ§Ãµes operacionais concluÃ­da)
- OperacionalizaÃ§Ã£o concluÃ­da: rotina diÃ¡ria por agendamento externo Windows para scan operacional de notificaÃ§Ãµes
- Em andamento: S11 (S11.1 Copiloto eControle MVP read-only concluida + migracao para Gemini 2.5 Flash com fallback Ollama opcional; S11.2 Dashboard Views concluido; S11.3 Cockpit de Automacoes operacional)
- Pendente: S9, S12

## S0 - Kickoff e congelamento do baseline

Status: concluÃ­do

Objetivo:
- Travar o ponto alvo de paridade com o v1 e reduzir risco de escopo.

Entregues:
- Baseline funcional em `docs/BASELINE_V1.md`.
- Mapa de reuso frontend em `docs/REUSE_FRONTEND_MAP.md`.
- Contratos de integraÃ§Ã£o em `docs/INTEGRATION_CONTRACTS.md`.
- DecisÃµes e riscos iniciais em `docs/RISKS_AND_DECISIONS_S0.md`.

Aceite:
- Ponto alvo definido e versionado.

## S1 - Repo v2 + Infra Docker

Status: concluÃ­do

Objetivo:
- Estruturar monorepo limpo e reproduzÃ­vel.

Entregues:
- Estrutura `backend/`, `frontend/`, `infra/`, `docs/`, `scripts/`.
- `infra/docker-compose.yml` com Postgres + Redis.
- `.env.example`.
- Healthchecks bÃ¡sicos (`/healthz`, `/api/v1/worker/health`).

Aceite:
- Infra sobe via Docker e API responde healthcheck.

## S2 - Core backend

Status: concluÃ­do

Objetivo:
- Consolidar base tÃ©cnica (config, db, migraÃ§Ãµes e testes).

Entregues:
- NÃºcleo em `backend/app/core` e sessÃ£o DB em `backend/app/db`.
- Alembic configurado.
- Harness de testes com Pytest.

Aceite:
- `alembic upgrade head` e `pytest` operacionais.

## S3 - Auth + RBAC

Status: concluÃ­do

Objetivo:
- Garantir autenticaÃ§Ã£o e autorizaÃ§Ã£o prÃ³prias no eControle.

Entregues:
- Endpoints: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Perfis RBAC `ADMIN`, `DEV`, `VIEW`.
- Seed inicial por ambiente dev.

Aceite:
- Login real e proteÃ§Ã£o de rotas por perfil funcionando.

## S4 - Multi-tenant e contexto de org

Status: concluÃ­do

Objetivo:
- Isolamento de dados por organizaÃ§Ã£o.

Entregues:
- `org_id` obrigatÃ³rio nas entidades de domÃ­nio.
- Filtros por org no backend.
- Endpoints de contexto/listagem de org.

Aceite:
- Isolamento entre orgs validado por testes.

## S5 - DomÃ­nio core (Empresas, LicenÃ§as, Taxas, Processos)

Status: concluÃ­do

Objetivo:
- Restaurar o nÃºcleo funcional do produto.

Entregues:
- CRUD e filtros principais dos quatro domÃ­nios.
- KPIs/alertas iniciais.
- Auditoria mÃ­nima de operaÃ§Ãµes.

Aceite:
- Front opera os fluxos centrais sem dependÃªncias do legado.

## S6 - Frontend reaproveitado

Status: concluÃ­do

Objetivo:
- Reusar o frontend v1 com adaptaÃ§Ãµes mÃ­nimas.

Entregues:
- Ajustes de base URL/portas e integraÃ§Ã£o com auth real.
- NavegaÃ§Ã£o principal e app shell estÃ¡veis.

Aceite:
- Login e navegaÃ§Ã£o principais funcionais no portal.

## S7 - Ingest inicial por JSON

Status: concluÃ­do

Objetivo:
- Substituir carga por planilha por ingest idempotente.

Entregues:
- Contratos `schemas/ingest`.
- Endpoints DEV de ingest.
- Datasets em `docs/ingest_jsons`.
- Tracking de runs em ingest.

Aceite:
- Reprocessamento sem duplicidade e com rastreabilidade.

## S8 - IntegraÃ§Ã£o CertHub (mirror de certificados)

Status: concluÃ­do

Objetivo:
- Entregar aba de certificados via mirror read-only + sync.

Entregues:
- Mirror local de certificados.
- Sync manual e health de certificados.
- Webhook CertHub (`upsert`, `delete`, `full`) com token dedicado.
- Deep link para instalaÃ§Ã£o no CertHub.

Aceite:
- Tela de certificados funcional mesmo com indisponibilidade temporÃ¡ria do CertHub.

## S9 - IntegraÃ§Ã£o Scribere

Status: pendente

Objetivo:
- Exports governados read-only via API interna.

## S10 - Workers/Jobs/Watchers

Status: em andamento

Objetivo:
- Jobs e watchers com idempotÃªncia, rastreabilidade e observabilidade mÃ­nima.

### S10.1a - Worker status API (MVP)

Status: concluÃ­do (2026-03-06)

Entregues:
- `GET /api/v1/worker/health` (ADMIN|DEV|VIEW)
- `GET /api/v1/worker/jobs/{job_id}` (ADMIN|DEV|VIEW)

### S10.1b - Upload + watcher de licenÃ§as (MVP)

Status: concluÃ­do (2026-03-06)

Entregues:
- `POST /api/v1/licencas/upload-bulk` (ADMIN|DEV) com escrita atÃ´mica (`.tmp -> rename`)
- nomes canÃ´nicos de licenÃ§a (`Val dd.mm.aaaa` e `Definitivo`)
- watcher externo (`python -m app.worker.watchers`)
- dedupe/idempotÃªncia por `licence_file_events`

### S10.2 - Auto-detecÃ§Ã£o assistida + hardening operacional

Status: concluÃ­do (2026-03-11)

Escopo confirmado:
- Endpoint `POST /api/v1/licencas/detect` (ADMIN|DEV), somente anÃ¡lise de filename.
- Fluxo assistido no frontend: usuÃ¡rio sempre confirma/corrige antes de salvar.
- Hierarquia por grupo na seleÃ§Ã£o de arquivo representante:
  - regra: `Definitivo > maior validade`
  - SANITÃRIA: `AlvarÃ¡ Vig SanitÃ¡ria` vs `Dispensa SanitÃ¡ria`
  - AMBIENTAL: `LicenÃ§a Ambiental` vs `Dispensa Ambiental`
  - FUNCIONAMENTO: definitivo/condicionado/provisÃ³rio
- Resolver de pastas de licenÃ§as para Matriz/Filial/MunicÃ­pio:
  - padrÃµes suportados:
    - `{Municipio} - Matriz|Filial`
    - `Matriz|Filial`
    - `{Municipio}/Matriz|Filial`
  - fallback para diretÃ³rio base apenas quando layout nÃ£o estruturado
  - upload falha com erro orientado quando layout estruturado estÃ¡ incompleto
  - watcher loga warning e nÃ£o adivinha path quando subdir esperada nÃ£o existe
- Higiene de repositÃ³rio:
  - sem `frontend/test-results` versionado
  - sem `patch.diff` versionado
  - `.gitignore` com regras explÃ­citas para artefatos Playwright/patches

CritÃ©rios de aceite S10.2 (parcial):
- [x] DetecÃ§Ã£o assistida sem auto-commit
- [x] RBAC aplicado (`ADMIN|DEV` permite, `VIEW` bloqueado)
- [x] Watcher respeita hierarquia por grupo
- [x] Upload e watcher usam mesmo resolvedor de pasta
- [x] Campo â€œApelido (Pasta)â€ validado no client e backend
- [x] Observabilidade mÃ­nima (`watchers_supported`) no health do worker
- [ ] ValidaÃ§Ã£o operacional completa no ambiente alvo com migrations e e2e completos

PendÃªncias registradas:
- [ ] Validar pipeline final com credenciais reais de E2E para cenÃ¡rios nÃ£o-skipped do Playwright.

### S10.3 - Motor de ClassificaÃ§Ã£o e PriorizaÃ§Ã£o por CNAE

Status: fase 3 (frontend + E2E portal) concluÃ­da (2026-03-13) + parcial (normalizaÃ§Ã£o + calibragem inicial de catÃ¡logo) em evoluÃ§Ã£o (2026-03-16)

Fase 1 (estrutural) entregue:
- tabela dedicada `cnae_risks`;
- snapshot de score em `company_profiles`:
  - `risco_consolidado`
  - `score_urgencia`
  - `score_status`
  - `score_updated_at`;
- exposiÃ§Ã£o dos campos em schemas de saÃ­da (sem ediÃ§Ã£o manual).

Fase 2 (motor + gatilhos backend) entregue:
- serviÃ§o central `backend/app/services/company_scoring.py`;
- cÃ¡lculo MVP por CNAE + vencimento de licenÃ§as;
- integraÃ§Ã£o de recÃ¡lculo em:
  - `PATCH /companies/{id}` (quando altera profile/CNAE),
  - `POST /companies/composite`,
  - ingest `company_profiles`,
  - bulk sync ReceitaWS (somente quando mudanÃ§as afetam score),
  - `PATCH /licencas/{id}/item`,
  - watcher de licenÃ§as (somente quando projeÃ§Ã£o realmente muda);
- suÃ­te de testes S10.3 adicionada em `backend/tests/test_company_scoring.py`.
- backfill one-shot para base legada:
  - script `backend/scripts/backfill_company_scores.py`;
  - execuÃ§Ã£o idempotente com `--org-id`, `--limit`, `--batch-size` e `--dry-run`;
  - recÃ¡lculo centralizado via `recalculate_company_score` (sem duplicar regra).

DecisÃµes fechadas:
- CNAEs permanecem em `company_profiles` (`cnaes_principal` e `cnaes_secundarios`);
- `companies` nÃ£o Ã© fonte de verdade para CNAE;
- payload bruto de lookup ReceitaWS nÃ£o Ã© persistido automaticamente no fluxo normal.

Pendente para prÃ³xima rodada:
- curadoria fina do catÃ¡logo `cnae_risks` (pesos/tiers por domÃ­nio regulatÃ³rio real).
- job diÃ¡rio de recÃ¡lculo de score apÃ³s atualizaÃ§Ã£o de catÃ¡logo.

Fase 3 (frontend + E2E portal) entregue:
- `frontend/src/pages/EmpresasScreen.jsx` atualizado para:
  - exibir score/risco/status de score;
  - filtrar por risco (`Todos`, `Alto`, `MÃ©dio`, `Baixo`);
  - ordenar por `score_urgencia` com `nulls last`;
  - exibir labels amigÃ¡veis de risco/status;
  - tratar valores nulos sem quebra de renderizaÃ§Ã£o;
  - evitar destaque do placeholder CNAE `00.00-0-00` como CNAE vÃ¡lido.
- E2E portal adicionado em `frontend/tests_e2e/portal/company_scoring.spec.ts`.

Parcial P1 (normalizaÃ§Ã£o canÃ´nica e operaÃ§Ã£o pÃ³s-seed) entregue:
- helper Ãºnico `backend/app/core/cnae.py` para normalizaÃ§Ã£o canÃ´nica de CNAE;
- aplicaÃ§Ã£o do helper nos fluxos:
  - `backend/app/services/company_scoring.py`
  - `backend/app/services/ingest/company_profiles.py`
  - `backend/app/services/receitaws_bulk_sync.py`
  - `backend/scripts/load_cnae_risks_seed.py`
- equivalÃªncia de formatos de CNAE no lookup de `cnae_risks`:
  - `56.11-2-01` == `5611201` == `56 11-2/01`
- seed operacional com recÃ¡lculo no mesmo fluxo transacional:
  - `--recalculate-affected` (somente impactados por insert/update de catÃ¡logo)
  - `--recalculate-all` (todos os profiles)
- sem remodelagem de banco, sem mover CNAE para `companies`, sem job diÃ¡rio nesta etapa.

Parcial atual (calibragem de catÃ¡logo) entregue:
- revisÃ£o do seed `backend/seeds/cnae_risks.seed.csv` para CNAEs mais usados, removendo perfil totalmente achatado;
- introduÃ§Ã£o de tiers/pesos reais (`LOW`, `MEDIUM`, `HIGH`) mantendo compatibilidade do motor;
- placeholders invÃ¡lidos (`00.00-0-00`, `********`, `NÃ£o informada`) tratados como ausÃªncia de CNAE no scoring (`NO_CNAE`);
- validaÃ§Ã£o por testes de:
  - placeholder -> `NO_CNAE`;
  - maior tier/peso refletido no snapshot;
  - recÃ¡lculo apÃ³s atualizaÃ§Ã£o de catÃ¡logo.

Subfase seguinte (base segura de atualizaÃ§Ã£o assistida) entregue em 2026-03-20:
- nova tabela `cnae_risk_suggestions` para propostas de atualizaÃ§Ã£o sem aplicaÃ§Ã£o automÃ¡tica direta;
- workflow de revisÃ£o humana com status:
  - `PENDING`, `APPROVED`, `REJECTED`, `APPLIED`;
- endpoints RBAC `ADMIN|DEV` para:
  - listar sugestÃµes,
  - criar sugestÃ£o manual/importada,
  - editar sugestÃ£o pendente,
  - aprovar (com aplicaÃ§Ã£o em `cnae_risks` + recÃ¡lculo de empresas afetadas),
  - rejeitar;
- recÃ¡lculo reutiliza serviÃ§o central `recalculate_company_score` (sem duplicar regra);
- auditoria mÃ­nima registrada em cada aÃ§Ã£o relevante de sugestÃ£o.

Pendente para prÃ³xima rodada desta linha:
- integraÃ§Ã£o com fontes oficiais via scraper/web crawling;
- automaÃ§Ã£o de proposta por importador (sempre como `PENDING`, sem aplicaÃ§Ã£o automÃ¡tica).

S10.3b entrega 2b (consulta oficial priorizada para sugestÃµes pendentes) entregue em 2026-03-20:
- camada de adaptadores oficiais em `backend/app/services/official_sources/`:
  - `anapolis.py`, `cgsim.py`, `anvisa.py`, `goiania.py`, `cbmgo.py`;
- schema interno normalizado de findings com:
  - `cnae_code`, `domain`, `official_result`, `suggested_risk_tier`, `suggested_base_weight`,
    `source_name`, `source_reference`, `evidence_excerpt`, `confidence`, `requires_questionnaire`;
- serviÃ§o orquestrador `backend/app/services/cnae_official_suggestions.py`:
  - consulta por CNAE Ãºnico ou lote,
  - consolida findings,
  - cria sugestÃµes `PENDING` sem tocar em `cnae_risks`,
  - prioriza `ANAPOLIS` como fonte municipal default quando nÃ£o hÃ¡ fonte municipal explÃ­cita,
  - mantÃ©m `GOIANIA` como fallback/referÃªncia (nÃ£o prioritÃ¡ria),
  - tolera falha de fonte externa sem derrubar resposta inteira,
  - deduplica sugestÃµes pendentes idÃªnticas;
- regras por fonte:
  - `ANAPOLIS`: base municipal oficial com Lei 4.438/2025, Uso do Solo, LC 349/2016 (Anexo V) e LC 377/2018 (Anexo Ãšnico), preservando rastreabilidade normativa;
  - `ANVISA`: parser online com prioridade na IN 66/2020 e apoio semÃ¢ntico da RDC 153/2017;
  - `CGSIM`: integraÃ§Ã£o resiliente de fonte oficial (`principal`, `/view`, `Ã­ndice`) com modo semi-real documentado para bloqueio HTTP 403;
  - `CBMGO`: fonte contextual (NT 01/2025 + anexo + NT 14/2025), sem fechar risco final sozinha por CNAE;
- endpoints `ADMIN|DEV`:
  - `POST /api/v1/catalog/cnae-risk-suggestions/official/lookup`
  - `POST /api/v1/catalog/cnae-risk-suggestions/official/lookup-batch`
- regra de seguranÃ§a reforÃ§ada:
  - consulta oficial nunca faz autoapply no catÃ¡logo produtivo;
  - toda saÃ­da automÃ¡tica desta camada permanece como sugestÃ£o `PENDING`.

### S10.4 - Notification Center MVP (feed por organizaÃ§Ã£o)

Status: concluÃ­do (2026-04-02)

Escopo entregue:
- nova tabela `notification_events` com:
  - `read_at` nullable para controle de nÃ£o lidas;
  - dedupe por `unique(org_id, dedupe_key)`;
  - Ã­ndices para feed e unread count por org.
- endpoints `ADMIN|DEV|VIEW`:
  - `GET /api/v1/notificacoes`
  - `GET /api/v1/notificacoes/unread-count`
  - `POST /api/v1/notificacoes/{id}/read`
- serviÃ§o backend reutilizÃ¡vel para emissÃ£o idempotente:
  - `backend/app/services/notifications.py`
- emissÃ£o inicial integrada ao fim de jobs:
  - `licence_scan_full`
  - `receitaws_bulk_sync`
  - `tax_portal_sync`
- frontend:
  - sino da Topbar com contador real de nÃ£o lidas;
  - painel simples com Ãºltimas notificaÃ§Ãµes;
  - marcar como lida;
  - navegaÃ§Ã£o por `route_path` quando disponÃ­vel.
- correÃ§Ã£o tÃ©cnica no mesmo patch:
  - remoÃ§Ã£o de inclusÃ£o duplicada de `worker.router` em `backend/app/api/v1/api.py`.

Fora de escopo nesta fase:
- inbox por usuÃ¡rio;
- dismiss/delete/retention;
- regras de vencimento por dias Ãºteis;
- varredura periÃ³dica de negÃ³cio para alertas de prazo.

### S10.5 - Notification Center Fase C (regras operacionais automÃ¡ticas)

Status: concluÃ­do (2026-04-02)

Escopo entregue:
- utilitÃ¡rio de dias Ãºteis:
  - `backend/app/services/business_days.py`
- serviÃ§o de scan operacional:
  - `backend/app/services/notification_operational_scan.py`
- endpoint manual:
  - `POST /api/v1/notificacoes/scan-operacional` (`ADMIN|DEV`)
- integraÃ§Ã£o de observabilidade com worker/jobs:
  - novo tipo de job `notification_operational_scan`
  - run table `notification_operational_scan_runs`
  - `worker/health` e `worker/jobs/{job_id}` atualizados
- regras automÃ¡ticas implementadas:
  - licenÃ§as:
    - CERCON/Bombeiros: `LIC_BOMBEIROS_BD5`
    - AlvarÃ¡ Funcionamento: `LIC_ALVARA_D30`
    - AlvarÃ¡ SanitÃ¡rio: `LIC_SANITARIO_D30`
    - LicenÃ§a Ambiental: `LIC_AMBIENTAL_BD30`
  - processos:
    - 7 dias Ãºteis sem atualizaÃ§Ã£o: `PROC_STALE_BD7`
    - 15 dias Ãºteis sem atualizaÃ§Ã£o: `PROC_STALE_BD15`
- referÃªncia de Ãºltima movimentaÃ§Ã£o de processo:
  - `updated_at` (principal)
  - fallback em `data_solicitacao`
- dedupe/idempotÃªncia:
  - `dedupe_key` determinÃ­stica por regra + entidade + janela
  - reprocessamento do scan sem duplicar notificaÃ§Ãµes

Testes desta fase:
- `backend/tests/test_business_days.py`
- `backend/tests/test_notification_rules.py`
- ampliaÃ§Ã£o de:
  - `backend/tests/test_notifications_endpoints.py`
  - `backend/tests/test_worker_endpoints.py`
- E2E API adicional:
  - `tests_e2e/api/test_notifications_operational_scan_e2e.py`

### S10.5b - OperacionalizaÃ§Ã£o diÃ¡ria do scan (scheduler externo Windows)

Status: concluÃ­do (2026-04-02)

DecisÃ£o aplicada:
- nÃ£o implementar scheduler interno no backend nesta fase;
- usar endpoint existente `POST /api/v1/notificacoes/scan-operacional` com script externo.

Entregues:
- script PowerShell operacional:
  - `scripts/ops/run_notification_operational_scan.ps1`
- wrapper para Task Scheduler:
  - `scripts/ops/run_notification_operational_scan.cmd`
- comportamento:
  - login em `/api/v1/auth/login`
  - trigger de scan
  - polling de `worker/jobs/{run_id}` atÃ© tÃ©rmino
  - `exit 0` em `completed`
  - `exit 1` em `failed`/`cancelled`/timeout/erro HTTP
  - log em arquivo com timestamp, `run_id`, status final e resumo
- configuraÃ§Ã£o:
  - por variÃ¡veis de ambiente
  - opcional por arquivo local nÃ£o versionado (`KEY=VALUE`)

## S11 - Polimento de paridade v1

Status: em andamento

Objetivo:
- Melhorias de UX, filtros avanÃ§ados, paginaÃ§Ã£o, ordenaÃ§Ã£o e performance.

### S11.1 - Copiloto eControle (widget de chat guiado read-only)

Status: concluÃ­do (2026-04-07) + refinado (2026-04-08)

Objetivo:
- Entregar MVP funcional de copiloto no portal com fluxo guiado por categoria e empresa, sem modo chatbot genÃ©rico e sem persistÃªncia automÃ¡tica.

Escopo entregue:
- Backend:
  - endpoint `POST /api/v1/copilot/respond` (`ADMIN|DEV|VIEW`);
  - categorias suportadas:
    - `COMPANY_SUMMARY`
    - `DOCUMENT_ANALYSIS`
    - `RISK_SIMULATION`
    - `DUVIDAS_DIVERSAS`
  - serviÃ§o central `backend/app/services/copilot.py` com:
    - resumo de empresa baseado em dados reais do domÃ­nio (overview, taxas, licenÃ§as, processos, score);
    - simulaÃ§Ã£o em memÃ³ria (sem persistÃªncia);
    - anÃ¡lise documental assistiva com upload opcional e comparaÃ§Ã£o orientativa.
  - refinamento S11.1:
    - categoria `DUVIDAS_DIVERSAS` com roteamento entre dÃºvida geral x dÃºvida dependente de empresa;
    - `company_id` opcional no endpoint para dÃºvidas gerais;
    - retorno `requires_company=true` quando pergunta exigir contexto da empresa e ela nÃ£o estiver selecionada;
    - hardening da anÃ¡lise documental:
      - nÃ£o classificar por nome de arquivo;
      - pipeline de PDF com extraÃ§Ã£o de texto e tentativa de renderizaÃ§Ã£o;
      - classificaÃ§Ã£o restrita a tipos permitidos;
      - sem expansÃ£o arbitrÃ¡ria de siglas;
      - retorno `NAO_CONCLUSIVO` com motivo quando faltar evidÃªncia factual.
  - migraÃ§Ã£o de provider em `backend/app/services/copilot_provider.py`:
    - principal: `gemini` (`gemini-2.5-flash`) via SDK oficial `google-genai`;
    - fallback opcional: `ollama` local (`gemma3:4b`);
    - ordem: Gemini -> fallback local -> erro controlado quando ambos falham;
    - envs suportadas:
      - `COPILOT_PROVIDER`, `COPILOT_PROVIDER_MODEL`, `COPILOT_PROVIDER_TIMEOUT_SECONDS`
      - `GEMINI_API_KEY`, `COPILOT_PROVIDER_ENABLE_WEB_SEARCH`
      - `COPILOT_FALLBACK_PROVIDER`, `COPILOT_FALLBACK_BASE_URL`, `COPILOT_FALLBACK_MODEL`, `COPILOT_FALLBACK_TIMEOUT_SECONDS`
  - `DUVIDAS_DIVERSAS` com web search/grounding controlada:
    - ativa principalmente em perguntas regulatÃ³rias/temporais ou com pedido explÃ­cito de fonte;
    - evita busca externa quando o pedido Ã© claramente baseado em dados internos da empresa;
    - retorna `grounding_used` e `sources` quando houver referÃªncias do provider.
- Frontend:
  - widget global flutuante no shell (`frontend/src/components/copilot/CopilotWidget.jsx`);
  - estados abrir/minimizar/fechar + persistÃªncia em `localStorage`;
  - fluxo guiado obrigatÃ³rio: categoria -> empresa (quando necessÃ¡rio) -> input manual;
  - busca de empresa com debounce (`frontend/src/hooks/useCopilotWidget.js`);
  - exemplos por categoria, upload em anÃ¡lise documental, respostas estruturadas e quick actions;
  - categoria `DUVIDAS_DIVERSAS` com input liberado sem empresa para perguntas gerais e bloqueio orientado quando empresa for necessÃ¡ria;
  - indicaÃ§Ã£o visual discreta de busca externa (`Resposta com busca externa`) e lista de fontes clicÃ¡veis quando houver grounding;
  - tratamento amigÃ¡vel de erros de provider (chave ausente, timeout, indisponibilidade, quota, fallback esgotado).
- SeguranÃ§a de produto:
  - escopo fechado em operaÃ§Ãµes eControle;
  - feature read-only (sem gravaÃ§Ã£o automÃ¡tica, sem jobs, sem mutaÃ§Ãµes de cadastros).

CritÃ©rios de aceite atendidos:
- [x] Widget global funcional no portal
- [x] Fluxo guiado por categorias
- [x] Empresa obrigatÃ³ria antes de input manual nas categorias que exigem empresa
- [x] Resposta Ãºtil para resumo de empresa
- [x] SimulaÃ§Ã£o de risco em memÃ³ria
- [x] Categoria `DUVIDAS_DIVERSAS` funcional sem empresa para perguntas gerais
- [x] AnÃ¡lise documental sem adivinhaÃ§Ã£o por nome de arquivo
- [x] ClassificaÃ§Ã£o documental em conjunto fechado com evidÃªncias e `NAO_CONCLUSIVO` quando necessÃ¡rio
- [x] AnÃ¡lise documental com degradaÃ§Ã£o controlada sem provider
- [x] RBAC `ADMIN|DEV|VIEW`
- [x] Sem persistÃªncia automÃ¡tica de alteraÃ§Ãµes pelo copiloto

Testes adicionados/atualizados:
- Backend:
  - `backend/tests/test_copilot_endpoints.py`
  - `backend/tests/test_copilot_provider.py`
  - cobertura:
    - categoria invÃ¡lida
    - empresa inexistente/fora da org
    - `DUVIDAS_DIVERSAS` sem empresa para pergunta geral
    - `DUVIDAS_DIVERSAS` orientando seleÃ§Ã£o de empresa quando necessÃ¡rio
    - resposta estruturada de resumo
    - simulaÃ§Ã£o sem persistÃªncia
    - anÃ¡lise documental nÃ£o dependente sÃ³ do nome do arquivo
    - caso de CND sem expansÃ£o inventada (ex.: evitar â€œCompliance Normativoâ€)
    - classificaÃ§Ã£o restrita ao conjunto permitido + `NAO_CONCLUSIVO`
    - degradaÃ§Ã£o sem provider configurado
    - stub/mock de provider para anÃ¡lise documental
    - seleÃ§Ã£o de provider (primÃ¡rio Gemini, fallback Ollama, erro final quando ambos falham)
    - leitura de envs do provider e fallback
    - `DUVIDAS_DIVERSAS` com sinalizaÃ§Ã£o de grounding/fontes
    - erro controlado para chave Gemini ausente e timeout de provider
    - autorizaÃ§Ã£o `VIEW`
- Portal E2E:
  - `frontend/tests_e2e/portal/copilot_widget.smoke.spec.ts`
  - cobertura:
    - widget visÃ­vel apÃ³s login
    - abrir/minimizar
    - categorias (inclui `DUVIDAS_DIVERSAS`)
    - bloqueio de input atÃ© selecionar empresa nas categorias aplicÃ¡veis
    - `DUVIDAS_DIVERSAS` perguntando sem empresa
    - retorno que exige empresa e exibiÃ§Ã£o da etapa de seleÃ§Ã£o
    - indicaÃ§Ã£o de busca externa e fontes clicÃ¡veis quando backend sinaliza grounding
    - fluxo de resumo estruturado
    - fluxo de simulaÃ§Ã£o
    - fluxo de documento com upload e tratamento de aviso
    - erro amigÃ¡vel quando provider falha.

PendÃªncias explÃ­citas:
- ExecuÃ§Ã£o completa da suÃ­te Playwright (`npm run test:e2e`) pode ultrapassar o timeout da automaÃ§Ã£o local; manter validaÃ§Ã£o por subconjunto impactado quando necessÃ¡rio.

### S11.2 - Dashboard Views (views salvas no Painel)

Status: concluido (2026-04-14)

Objetivo:
- Permitir salvar, reutilizar e compartilhar configuracoes de visualizacao do painel por organizacao.

Escopo entregue:
- Tabela dedicada `dashboard_saved_views` com isolamento por `org_id`.
- Endpoints `ADMIN|DEV|VIEW`:
  - `GET /api/v1/dashboard/views`
  - `POST /api/v1/dashboard/views`
  - `PATCH /api/v1/dashboard/views/{view_id}`
  - `DELETE /api/v1/dashboard/views/{view_id}`
- Regras de permissao:
  - `scope=shared` gerenciavel por `ADMIN|DEV`;
  - views pessoais editaveis pelo criador.
- Frontend integrado no Painel:
  - servico `frontend/src/services/dashboardViews.js`;
  - uso em `frontend/src/pages/PainelScreen.jsx`;
  - atalhos de foco via `saved_views` no shell principal.

Validacao:
- testes backend em `backend/tests/test_dashboard_saved_views.py`.

### S11.3 - Cockpit de Automacoes (observabilidade operacional)

Status: concluido (ciclo S11)

Objetivo:
- Centralizar estado operacional dos jobs e auditoria recente em uma tela unica no portal.

Escopo entregue:
- Endpoint de snapshot operacional:
  - `GET /api/v1/worker/snapshot` (`ADMIN|DEV|VIEW`)
  - consolida ultimas runs de:
    - `receitaws_bulk_sync`
    - `licence_scan_full`
    - `tax_portal_sync`
    - `notification_operational_scan`
  - agrega auditoria por eventos `job.*` da tabela `notification_events`.
- Frontend:
  - nova tela `frontend/src/pages/AutomacoesScreen.jsx`;
  - integracao no shell em `frontend/src/pages/MainApp.tsx` com aba `automacoes`;
  - polling periodico e filtros de operacao (dominio, status, owner, falhas).

Observacao:
- esta entrega reutiliza infraestrutura de jobs/notificacoes do S10 e nao introduz novo tipo de run table.

### Tax Portal Sync (backend estrutural + Subfase B frontend)
- run table `tax_portal_sync_runs`
- service `tax_portal_sync`
- runtime `tax_portal_runtime`
- persistÃªncia em `company_taxes`
- integraÃ§Ã£o com `/worker/jobs`
- script operacional `backend/scripts/run_tax_portal_sync_once.py`
- fase backend fechada em 2026-03-26:
  - `dry_run=false` persistindo em `company_taxes`;
  - `dry_run=true` sem persistÃªncia;
  - `raw.tax_portal_sync` com evidÃªncias da run;
  - recÃ¡lculo de `status_taxas`;
  - summary da run com `field_counters`, `companies_with_debits`, `companies_marked_paid`, `filtered_out_count`, `sample_results`;
  - testes backend adicionais cobrindo persistÃªncia/regra `*` e `Pago`/metadados de `/worker/jobs`.
- Subfase B frontend concluÃ­da em 2026-03-26:
  - service frontend dedicado (`start`, `active`, `status`, `cancel`);
  - hook dedicado com polling, retomada de run ativa, loading/error e limpeza de intervalo ao desmontar;
  - manager visual inspirado no BulkSyncManager (progresso, contadores, municÃ­pio, dry-run, run_id, erros recentes e resumo final);
  - integraÃ§Ã£o na `TaxasScreen` com RBAC (`ADMIN|DEV` inicia/cancela, `VIEW` sem aÃ§Ã£o);
  - smoke E2E Playwright: `frontend/tests_e2e/portal/taxas_tax_portal_sync.smoke.spec.ts`.

## Patch RegulatÃ³rio 1 (2026-04-23)

Status: concluÃ­do

Escopo entregue:
- modelagem explÃ­cita de domÃ­nio em banco/ORM/contracts:
  - `company_licences.alvara_funcionamento_kind`
  - `company_profiles.sanitary_complexity`
  - `company_profiles.address_usage_type`
  - `company_profiles.address_location_type`
- enums e normalizaÃ§Ã£o centralizados em `backend/app/core/regulatory.py`
- migration/backfill conservador:
  - `backend/alembic/versions/20260423_0030_add_regulatory_domain_fields.py`
- endpoints atualizados:
  - `backend/app/api/v1/endpoints/companies.py`
  - `backend/app/api/v1/endpoints/companies_composite.py`
  - `backend/app/api/v1/endpoints/company_licences.py`
  - `backend/app/api/v1/endpoints/meta.py`
- watcher e upload assistido passam a persistir `alvara_funcionamento_kind` explicitamente em `company_licences`
- overview passa a expor os novos campos no backend e de forma simples no portal

Backfill aplicado:
- `alvara_funcionamento_kind`
  - usa `raw.source_document_kind_alvara_funcionamento` quando o tipo detectado Ã© confiÃ¡vel
  - usa `DEFINITIVO` quando `raw.source_kind_alvara_funcionamento == "definitivo"`
  - fallback para `PENDENTE_REVISAO` nos casos ambÃ­guos
- `sanitary_complexity`
  - default `PENDENTE_REVISAO`
- `address_usage_type`
  - `FISCAL` apenas quando `raw.endereco_fiscal == true`
  - demais casos em `PENDENTE_REVISAO`
- `address_location_type`
  - default `PENDENTE_REVISAO`

Fora de escopo mantido:
- regra completa de score regulatÃ³rio
- regra completa de notificaÃ§Ãµes regulatÃ³rias
- heurÃ­stica final de invalidaÃ§Ã£o do alvarÃ¡ definitivo por processo
- bloqueios operacionais complexos no frontend

ValidaÃ§Ã£o adicionada:
- backend:
  - `backend/tests/test_regulatory_migration_backfill.py`
  - `backend/tests/test_companies_composite.py`
  - `backend/tests/test_companies_crud.py`
  - `backend/tests/test_company_licences_endpoint.py`
  - `backend/tests/test_licence_watcher.py`
  - `backend/tests/test_company_overview.py`
  - `backend/tests/test_processes_canonical.py`
- portal E2E:
  - `frontend/tests_e2e/portal/company_overview.spec.ts`
  - `frontend/tests_e2e/portal/regression_drawers.spec.ts`

## Patch RegulatÃ³rio 2 (2026-04-23)

Status: concluÃ­do

Escopo entregue:
- serviÃ§o central de regra em `backend/app/services/licence_regulatory_rules.py`
- invalidaÃ§Ã£o conservadora de alvarÃ¡ definitivo por alteraÃ§Ã£o cadastral com base em:
  - `process_type`
  - `orgao`
  - `operacao`
  - `obs`
  - `updated_at`
- score ajustado para:
  - nÃ£o usar alvarÃ¡ definitivo vÃ¡lido como ausÃªncia de licenÃ§a;
  - introduzir `OK_DEFINITIVE` e `DEFINITIVE_INVALIDATED`;
  - ignorar renovaÃ§Ã£o periÃ³dica do alvarÃ¡ quando `alvara_funcionamento_kind = DEFINITIVO`
- notificaÃ§Ãµes operacionais ajustadas para:
  - ignorar `LIC_ALVARA_D30` no caso de definitivo;
  - emitir `LIC_DEFINITIVO_INVALIDADO` quando houver invalidaÃ§Ã£o conservadora
- overview atualizado para expor:
  - `regulatory`
  - `regulatory_status`
  - `invalidated_reasons`
  - `invalidating_process_ref`
  - `requires_new_licence_request`
- portal ajustado de forma incremental no drawer de overview e labels de score

Fora de escopo mantido:
- bloqueio operacional por vistoria/endereÃ§o
- workflow humano completo de revisÃ£o
- heurÃ­sticas amplas alÃ©m da regra textual conservadora
- automaÃ§Ãµes extras fora de score/notificaÃ§Ãµes/overview

ValidaÃ§Ã£o adicionada:
- backend:
  - `backend/tests/test_licence_regulatory_rules.py`
  - `backend/tests/test_company_scoring.py`
  - `backend/tests/test_notification_rules.py`
  - `backend/tests/test_company_overview.py`
- portal E2E:
  - `frontend/tests_e2e/portal/company_overview.spec.ts`
  - regressÃ£o mantida em `frontend/tests_e2e/portal/regression_drawers.spec.ts`

## S12 - Hardening e go-live

Status: pendente

Objetivo:
- Runbooks finais, seguranÃ§a operacional e testes de regressÃ£o ampliados.


