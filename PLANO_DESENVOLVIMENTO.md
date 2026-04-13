# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referência: 2026-04-08

## Visão geral

Status global: domínio principal operacional, ingest JSON ativo, integração CertHub em produção interna e Stage S10 em evolução.

- Concluído: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Concluído: S8
- Entrega adicional concluída: bulk sync ReceitaWS (DEV)
- Em andamento: S10 (S10.1a + S10.1b + S10.2 concluídos; S10.3 fase 3 concluída; S10.4 Notification Center MVP concluído; S10.5 Fase C de notificações operacionais concluída)
- Operacionalização concluída: rotina diária por agendamento externo Windows para scan operacional de notificações
- Em andamento: S11 (S11.1 Copiloto eControle MVP read-only concluída + migração para Gemini 2.5 Flash com fallback Ollama opcional)
- Pendente: S9, S12

## S0 - Kickoff e congelamento do baseline

Status: concluído

Objetivo:
- Travar o ponto alvo de paridade com o v1 e reduzir risco de escopo.

Entregues:
- Baseline funcional em `docs/BASELINE_V1.md`.
- Mapa de reuso frontend em `docs/REUSE_FRONTEND_MAP.md`.
- Contratos de integração em `docs/INTEGRATION_CONTRACTS.md`.
- Decisões e riscos iniciais em `docs/RISKS_AND_DECISIONS_S0.md`.

Aceite:
- Ponto alvo definido e versionado.

## S1 - Repo v2 + Infra Docker

Status: concluído

Objetivo:
- Estruturar monorepo limpo e reproduzível.

Entregues:
- Estrutura `backend/`, `frontend/`, `infra/`, `docs/`, `scripts/`.
- `infra/docker-compose.yml` com Postgres + Redis.
- `.env.example`.
- Healthchecks básicos (`/healthz`, `/api/v1/worker/health`).

Aceite:
- Infra sobe via Docker e API responde healthcheck.

## S2 - Core backend

Status: concluído

Objetivo:
- Consolidar base técnica (config, db, migrações e testes).

Entregues:
- Núcleo em `backend/app/core` e sessão DB em `backend/app/db`.
- Alembic configurado.
- Harness de testes com Pytest.

Aceite:
- `alembic upgrade head` e `pytest` operacionais.

## S3 - Auth + RBAC

Status: concluído

Objetivo:
- Garantir autenticação e autorização próprias no eControle.

Entregues:
- Endpoints: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Perfis RBAC `ADMIN`, `DEV`, `VIEW`.
- Seed inicial por ambiente dev.

Aceite:
- Login real e proteção de rotas por perfil funcionando.

## S4 - Multi-tenant e contexto de org

Status: concluído

Objetivo:
- Isolamento de dados por organização.

Entregues:
- `org_id` obrigatório nas entidades de domínio.
- Filtros por org no backend.
- Endpoints de contexto/listagem de org.

Aceite:
- Isolamento entre orgs validado por testes.

## S5 - Domínio core (Empresas, Licenças, Taxas, Processos)

Status: concluído

Objetivo:
- Restaurar o núcleo funcional do produto.

Entregues:
- CRUD e filtros principais dos quatro domínios.
- KPIs/alertas iniciais.
- Auditoria mínima de operações.

Aceite:
- Front opera os fluxos centrais sem dependências do legado.

## S6 - Frontend reaproveitado

Status: concluído

Objetivo:
- Reusar o frontend v1 com adaptações mínimas.

Entregues:
- Ajustes de base URL/portas e integração com auth real.
- Navegação principal e app shell estáveis.

Aceite:
- Login e navegação principais funcionais no portal.

## S7 - Ingest inicial por JSON

Status: concluído

Objetivo:
- Substituir carga por planilha por ingest idempotente.

Entregues:
- Contratos `schemas/ingest`.
- Endpoints DEV de ingest.
- Datasets em `docs/ingest_jsons`.
- Tracking de runs em ingest.

Aceite:
- Reprocessamento sem duplicidade e com rastreabilidade.

## S8 - Integração CertHub (mirror de certificados)

Status: concluído

Objetivo:
- Entregar aba de certificados via mirror read-only + sync.

Entregues:
- Mirror local de certificados.
- Sync manual e health de certificados.
- Webhook CertHub (`upsert`, `delete`, `full`) com token dedicado.
- Deep link para instalação no CertHub.

Aceite:
- Tela de certificados funcional mesmo com indisponibilidade temporária do CertHub.

## S9 - Integração Scribere

Status: pendente

Objetivo:
- Exports governados read-only via API interna.

## S10 - Workers/Jobs/Watchers

Status: em andamento

Objetivo:
- Jobs e watchers com idempotência, rastreabilidade e observabilidade mínima.

### S10.1a - Worker status API (MVP)

Status: concluído (2026-03-06)

Entregues:
- `GET /api/v1/worker/health` (ADMIN|DEV|VIEW)
- `GET /api/v1/worker/jobs/{job_id}` (ADMIN|DEV|VIEW)

### S10.1b - Upload + watcher de licenças (MVP)

Status: concluído (2026-03-06)

Entregues:
- `POST /api/v1/licencas/upload-bulk` (ADMIN|DEV) com escrita atômica (`.tmp -> rename`)
- nomes canônicos de licença (`Val dd.mm.aaaa` e `Definitivo`)
- watcher externo (`python -m app.worker.watchers`)
- dedupe/idempotência por `licence_file_events`

### S10.2 - Auto-detecção assistida + hardening operacional

Status: concluído (2026-03-11)

Escopo confirmado:
- Endpoint `POST /api/v1/licencas/detect` (ADMIN|DEV), somente análise de filename.
- Fluxo assistido no frontend: usuário sempre confirma/corrige antes de salvar.
- Hierarquia por grupo na seleção de arquivo representante:
  - regra: `Definitivo > maior validade`
  - SANITÁRIA: `Alvará Vig Sanitária` vs `Dispensa Sanitária`
  - AMBIENTAL: `Licença Ambiental` vs `Dispensa Ambiental`
  - FUNCIONAMENTO: definitivo/condicionado/provisório
- Resolver de pastas de licenças para Matriz/Filial/Município:
  - padrões suportados:
    - `{Municipio} - Matriz|Filial`
    - `Matriz|Filial`
    - `{Municipio}/Matriz|Filial`
  - fallback para diretório base apenas quando layout não estruturado
  - upload falha com erro orientado quando layout estruturado está incompleto
  - watcher loga warning e não adivinha path quando subdir esperada não existe
- Higiene de repositório:
  - sem `frontend/test-results` versionado
  - sem `patch.diff` versionado
  - `.gitignore` com regras explícitas para artefatos Playwright/patches

Critérios de aceite S10.2 (parcial):
- [x] Detecção assistida sem auto-commit
- [x] RBAC aplicado (`ADMIN|DEV` permite, `VIEW` bloqueado)
- [x] Watcher respeita hierarquia por grupo
- [x] Upload e watcher usam mesmo resolvedor de pasta
- [x] Campo “Apelido (Pasta)” validado no client e backend
- [x] Observabilidade mínima (`watchers_supported`) no health do worker
- [ ] Validação operacional completa no ambiente alvo com migrations e e2e completos

Pendências registradas:
- [ ] Validar pipeline final com credenciais reais de E2E para cenários não-skipped do Playwright.

### S10.3 - Motor de Classificação e Priorização por CNAE

Status: fase 3 (frontend + E2E portal) concluída (2026-03-13) + parcial (normalização + calibragem inicial de catálogo) em evolução (2026-03-16)

Fase 1 (estrutural) entregue:
- tabela dedicada `cnae_risks`;
- snapshot de score em `company_profiles`:
  - `risco_consolidado`
  - `score_urgencia`
  - `score_status`
  - `score_updated_at`;
- exposição dos campos em schemas de saída (sem edição manual).

Fase 2 (motor + gatilhos backend) entregue:
- serviço central `backend/app/services/company_scoring.py`;
- cálculo MVP por CNAE + vencimento de licenças;
- integração de recálculo em:
  - `PATCH /companies/{id}` (quando altera profile/CNAE),
  - `POST /companies/composite`,
  - ingest `company_profiles`,
  - bulk sync ReceitaWS (somente quando mudanças afetam score),
  - `PATCH /licencas/{id}/item`,
  - watcher de licenças (somente quando projeção realmente muda);
- suíte de testes S10.3 adicionada em `backend/tests/test_company_scoring.py`.
- backfill one-shot para base legada:
  - script `backend/scripts/backfill_company_scores.py`;
  - execução idempotente com `--org-id`, `--limit`, `--batch-size` e `--dry-run`;
  - recálculo centralizado via `recalculate_company_score` (sem duplicar regra).

Decisões fechadas:
- CNAEs permanecem em `company_profiles` (`cnaes_principal` e `cnaes_secundarios`);
- `companies` não é fonte de verdade para CNAE;
- payload bruto de lookup ReceitaWS não é persistido automaticamente no fluxo normal.

Pendente para próxima rodada:
- curadoria fina do catálogo `cnae_risks` (pesos/tiers por domínio regulatório real).
- job diário de recálculo de score após atualização de catálogo.

Fase 3 (frontend + E2E portal) entregue:
- `frontend/src/pages/EmpresasScreen.jsx` atualizado para:
  - exibir score/risco/status de score;
  - filtrar por risco (`Todos`, `Alto`, `Médio`, `Baixo`);
  - ordenar por `score_urgencia` com `nulls last`;
  - exibir labels amigáveis de risco/status;
  - tratar valores nulos sem quebra de renderização;
  - evitar destaque do placeholder CNAE `00.00-0-00` como CNAE válido.
- E2E portal adicionado em `frontend/tests_e2e/portal/company_scoring.spec.ts`.

Parcial P1 (normalização canônica e operação pós-seed) entregue:
- helper único `backend/app/core/cnae.py` para normalização canônica de CNAE;
- aplicação do helper nos fluxos:
  - `backend/app/services/company_scoring.py`
  - `backend/app/services/ingest/company_profiles.py`
  - `backend/app/services/receitaws_bulk_sync.py`
  - `backend/scripts/load_cnae_risks_seed.py`
- equivalência de formatos de CNAE no lookup de `cnae_risks`:
  - `56.11-2-01` == `5611201` == `56 11-2/01`
- seed operacional com recálculo no mesmo fluxo transacional:
  - `--recalculate-affected` (somente impactados por insert/update de catálogo)
  - `--recalculate-all` (todos os profiles)
- sem remodelagem de banco, sem mover CNAE para `companies`, sem job diário nesta etapa.

Parcial atual (calibragem de catálogo) entregue:
- revisão do seed `backend/seeds/cnae_risks.seed.csv` para CNAEs mais usados, removendo perfil totalmente achatado;
- introdução de tiers/pesos reais (`LOW`, `MEDIUM`, `HIGH`) mantendo compatibilidade do motor;
- placeholders inválidos (`00.00-0-00`, `********`, `Não informada`) tratados como ausência de CNAE no scoring (`NO_CNAE`);
- validação por testes de:
  - placeholder -> `NO_CNAE`;
  - maior tier/peso refletido no snapshot;
  - recálculo após atualização de catálogo.

Subfase seguinte (base segura de atualização assistida) entregue em 2026-03-20:
- nova tabela `cnae_risk_suggestions` para propostas de atualização sem aplicação automática direta;
- workflow de revisão humana com status:
  - `PENDING`, `APPROVED`, `REJECTED`, `APPLIED`;
- endpoints RBAC `ADMIN|DEV` para:
  - listar sugestões,
  - criar sugestão manual/importada,
  - editar sugestão pendente,
  - aprovar (com aplicação em `cnae_risks` + recálculo de empresas afetadas),
  - rejeitar;
- recálculo reutiliza serviço central `recalculate_company_score` (sem duplicar regra);
- auditoria mínima registrada em cada ação relevante de sugestão.

Pendente para próxima rodada desta linha:
- integração com fontes oficiais via scraper/web crawling;
- automação de proposta por importador (sempre como `PENDING`, sem aplicação automática).

S10.3b entrega 2b (consulta oficial priorizada para sugestões pendentes) entregue em 2026-03-20:
- camada de adaptadores oficiais em `backend/app/services/official_sources/`:
  - `anapolis.py`, `cgsim.py`, `anvisa.py`, `goiania.py`, `cbmgo.py`;
- schema interno normalizado de findings com:
  - `cnae_code`, `domain`, `official_result`, `suggested_risk_tier`, `suggested_base_weight`,
    `source_name`, `source_reference`, `evidence_excerpt`, `confidence`, `requires_questionnaire`;
- serviço orquestrador `backend/app/services/cnae_official_suggestions.py`:
  - consulta por CNAE único ou lote,
  - consolida findings,
  - cria sugestões `PENDING` sem tocar em `cnae_risks`,
  - prioriza `ANAPOLIS` como fonte municipal default quando não há fonte municipal explícita,
  - mantém `GOIANIA` como fallback/referência (não prioritária),
  - tolera falha de fonte externa sem derrubar resposta inteira,
  - deduplica sugestões pendentes idênticas;
- regras por fonte:
  - `ANAPOLIS`: base municipal oficial com Lei 4.438/2025, Uso do Solo, LC 349/2016 (Anexo V) e LC 377/2018 (Anexo Único), preservando rastreabilidade normativa;
  - `ANVISA`: parser online com prioridade na IN 66/2020 e apoio semântico da RDC 153/2017;
  - `CGSIM`: integração resiliente de fonte oficial (`principal`, `/view`, `índice`) com modo semi-real documentado para bloqueio HTTP 403;
  - `CBMGO`: fonte contextual (NT 01/2025 + anexo + NT 14/2025), sem fechar risco final sozinha por CNAE;
- endpoints `ADMIN|DEV`:
  - `POST /api/v1/catalog/cnae-risk-suggestions/official/lookup`
  - `POST /api/v1/catalog/cnae-risk-suggestions/official/lookup-batch`
- regra de segurança reforçada:
  - consulta oficial nunca faz autoapply no catálogo produtivo;
  - toda saída automática desta camada permanece como sugestão `PENDING`.

### S10.4 - Notification Center MVP (feed por organização)

Status: concluído (2026-04-02)

Escopo entregue:
- nova tabela `notification_events` com:
  - `read_at` nullable para controle de não lidas;
  - dedupe por `unique(org_id, dedupe_key)`;
  - índices para feed e unread count por org.
- endpoints `ADMIN|DEV|VIEW`:
  - `GET /api/v1/notificacoes`
  - `GET /api/v1/notificacoes/unread-count`
  - `POST /api/v1/notificacoes/{id}/read`
- serviço backend reutilizável para emissão idempotente:
  - `backend/app/services/notifications.py`
- emissão inicial integrada ao fim de jobs:
  - `licence_scan_full`
  - `receitaws_bulk_sync`
  - `tax_portal_sync`
- frontend:
  - sino da Topbar com contador real de não lidas;
  - painel simples com últimas notificações;
  - marcar como lida;
  - navegação por `route_path` quando disponível.
- correção técnica no mesmo patch:
  - remoção de inclusão duplicada de `worker.router` em `backend/app/api/v1/api.py`.

Fora de escopo nesta fase:
- inbox por usuário;
- dismiss/delete/retention;
- regras de vencimento por dias úteis;
- varredura periódica de negócio para alertas de prazo.

### S10.5 - Notification Center Fase C (regras operacionais automáticas)

Status: concluído (2026-04-02)

Escopo entregue:
- utilitário de dias úteis:
  - `backend/app/services/business_days.py`
- serviço de scan operacional:
  - `backend/app/services/notification_operational_scan.py`
- endpoint manual:
  - `POST /api/v1/notificacoes/scan-operacional` (`ADMIN|DEV`)
- integração de observabilidade com worker/jobs:
  - novo tipo de job `notification_operational_scan`
  - run table `notification_operational_scan_runs`
  - `worker/health` e `worker/jobs/{job_id}` atualizados
- regras automáticas implementadas:
  - licenças:
    - CERCON/Bombeiros: `LIC_BOMBEIROS_BD5`
    - Alvará Funcionamento: `LIC_ALVARA_D30`
    - Alvará Sanitário: `LIC_SANITARIO_D30`
    - Licença Ambiental: `LIC_AMBIENTAL_BD30`
  - processos:
    - 7 dias úteis sem atualização: `PROC_STALE_BD7`
    - 15 dias úteis sem atualização: `PROC_STALE_BD15`
- referência de última movimentação de processo:
  - `updated_at` (principal)
  - fallback em `data_solicitacao`
- dedupe/idempotência:
  - `dedupe_key` determinística por regra + entidade + janela
  - reprocessamento do scan sem duplicar notificações

Testes desta fase:
- `backend/tests/test_business_days.py`
- `backend/tests/test_notification_rules.py`
- ampliação de:
  - `backend/tests/test_notifications_endpoints.py`
  - `backend/tests/test_worker_endpoints.py`
- E2E API adicional:
  - `tests_e2e/api/test_notifications_operational_scan_e2e.py`

### S10.5b - Operacionalização diária do scan (scheduler externo Windows)

Status: concluído (2026-04-02)

Decisão aplicada:
- não implementar scheduler interno no backend nesta fase;
- usar endpoint existente `POST /api/v1/notificacoes/scan-operacional` com script externo.

Entregues:
- script PowerShell operacional:
  - `scripts/ops/run_notification_operational_scan.ps1`
- wrapper para Task Scheduler:
  - `scripts/ops/run_notification_operational_scan.cmd`
- comportamento:
  - login em `/api/v1/auth/login`
  - trigger de scan
  - polling de `worker/jobs/{run_id}` até término
  - `exit 0` em `completed`
  - `exit 1` em `failed`/`cancelled`/timeout/erro HTTP
  - log em arquivo com timestamp, `run_id`, status final e resumo
- configuração:
  - por variáveis de ambiente
  - opcional por arquivo local não versionado (`KEY=VALUE`)

## S11 - Polimento de paridade v1

Status: em andamento

Objetivo:
- Melhorias de UX, filtros avançados, paginação, ordenação e performance.

### S11.1 - Copiloto eControle (widget de chat guiado read-only)

Status: concluído (2026-04-07) + refinado (2026-04-08)

Objetivo:
- Entregar MVP funcional de copiloto no portal com fluxo guiado por categoria e empresa, sem modo chatbot genérico e sem persistência automática.

Escopo entregue:
- Backend:
  - endpoint `POST /api/v1/copilot/respond` (`ADMIN|DEV|VIEW`);
  - categorias suportadas:
    - `COMPANY_SUMMARY`
    - `DOCUMENT_ANALYSIS`
    - `RISK_SIMULATION`
    - `DUVIDAS_DIVERSAS`
  - serviço central `backend/app/services/copilot.py` com:
    - resumo de empresa baseado em dados reais do domínio (overview, taxas, licenças, processos, score);
    - simulação em memória (sem persistência);
    - análise documental assistiva com upload opcional e comparação orientativa.
  - refinamento S11.1:
    - categoria `DUVIDAS_DIVERSAS` com roteamento entre dúvida geral x dúvida dependente de empresa;
    - `company_id` opcional no endpoint para dúvidas gerais;
    - retorno `requires_company=true` quando pergunta exigir contexto da empresa e ela não estiver selecionada;
    - hardening da análise documental:
      - não classificar por nome de arquivo;
      - pipeline de PDF com extração de texto e tentativa de renderização;
      - classificação restrita a tipos permitidos;
      - sem expansão arbitrária de siglas;
      - retorno `NAO_CONCLUSIVO` com motivo quando faltar evidência factual.
  - migração de provider em `backend/app/services/copilot_provider.py`:
    - principal: `gemini` (`gemini-2.5-flash`) via SDK oficial `google-genai`;
    - fallback opcional: `ollama` local (`gemma3:4b`);
    - ordem: Gemini -> fallback local -> erro controlado quando ambos falham;
    - envs suportadas:
      - `COPILOT_PROVIDER`, `COPILOT_PROVIDER_MODEL`, `COPILOT_PROVIDER_TIMEOUT_SECONDS`
      - `GEMINI_API_KEY`, `COPILOT_PROVIDER_ENABLE_WEB_SEARCH`
      - `COPILOT_FALLBACK_PROVIDER`, `COPILOT_FALLBACK_BASE_URL`, `COPILOT_FALLBACK_MODEL`, `COPILOT_FALLBACK_TIMEOUT_SECONDS`
  - `DUVIDAS_DIVERSAS` com web search/grounding controlada:
    - ativa principalmente em perguntas regulatórias/temporais ou com pedido explícito de fonte;
    - evita busca externa quando o pedido é claramente baseado em dados internos da empresa;
    - retorna `grounding_used` e `sources` quando houver referências do provider.
- Frontend:
  - widget global flutuante no shell (`frontend/src/components/copilot/CopilotWidget.jsx`);
  - estados abrir/minimizar/fechar + persistência em `localStorage`;
  - fluxo guiado obrigatório: categoria -> empresa (quando necessário) -> input manual;
  - busca de empresa com debounce (`frontend/src/hooks/useCopilotWidget.js`);
  - exemplos por categoria, upload em análise documental, respostas estruturadas e quick actions;
  - categoria `DUVIDAS_DIVERSAS` com input liberado sem empresa para perguntas gerais e bloqueio orientado quando empresa for necessária;
  - indicação visual discreta de busca externa (`Resposta com busca externa`) e lista de fontes clicáveis quando houver grounding;
  - tratamento amigável de erros de provider (chave ausente, timeout, indisponibilidade, quota, fallback esgotado).
- Segurança de produto:
  - escopo fechado em operações eControle;
  - feature read-only (sem gravação automática, sem jobs, sem mutações de cadastros).

Critérios de aceite atendidos:
- [x] Widget global funcional no portal
- [x] Fluxo guiado por categorias
- [x] Empresa obrigatória antes de input manual nas categorias que exigem empresa
- [x] Resposta útil para resumo de empresa
- [x] Simulação de risco em memória
- [x] Categoria `DUVIDAS_DIVERSAS` funcional sem empresa para perguntas gerais
- [x] Análise documental sem adivinhação por nome de arquivo
- [x] Classificação documental em conjunto fechado com evidências e `NAO_CONCLUSIVO` quando necessário
- [x] Análise documental com degradação controlada sem provider
- [x] RBAC `ADMIN|DEV|VIEW`
- [x] Sem persistência automática de alterações pelo copiloto

Testes adicionados/atualizados:
- Backend:
  - `backend/tests/test_copilot_endpoints.py`
  - `backend/tests/test_copilot_provider.py`
  - cobertura:
    - categoria inválida
    - empresa inexistente/fora da org
    - `DUVIDAS_DIVERSAS` sem empresa para pergunta geral
    - `DUVIDAS_DIVERSAS` orientando seleção de empresa quando necessário
    - resposta estruturada de resumo
    - simulação sem persistência
    - análise documental não dependente só do nome do arquivo
    - caso de CND sem expansão inventada (ex.: evitar “Compliance Normativo”)
    - classificação restrita ao conjunto permitido + `NAO_CONCLUSIVO`
    - degradação sem provider configurado
    - stub/mock de provider para análise documental
    - seleção de provider (primário Gemini, fallback Ollama, erro final quando ambos falham)
    - leitura de envs do provider e fallback
    - `DUVIDAS_DIVERSAS` com sinalização de grounding/fontes
    - erro controlado para chave Gemini ausente e timeout de provider
    - autorização `VIEW`
- Portal E2E:
  - `frontend/tests_e2e/portal/copilot_widget.smoke.spec.ts`
  - cobertura:
    - widget visível após login
    - abrir/minimizar
    - categorias (inclui `DUVIDAS_DIVERSAS`)
    - bloqueio de input até selecionar empresa nas categorias aplicáveis
    - `DUVIDAS_DIVERSAS` perguntando sem empresa
    - retorno que exige empresa e exibição da etapa de seleção
    - indicação de busca externa e fontes clicáveis quando backend sinaliza grounding
    - fluxo de resumo estruturado
    - fluxo de simulação
    - fluxo de documento com upload e tratamento de aviso
    - erro amigável quando provider falha.

Pendências explícitas:
- Execução completa da suíte Playwright (`npm run test:e2e`) pode ultrapassar o timeout da automação local; manter validação por subconjunto impactado quando necessário.

### Tax Portal Sync (backend estrutural + Subfase B frontend)
- run table `tax_portal_sync_runs`
- service `tax_portal_sync`
- runtime `tax_portal_runtime`
- persistência em `company_taxes`
- integração com `/worker/jobs`
- script operacional `backend/scripts/run_tax_portal_sync_once.py`
- fase backend fechada em 2026-03-26:
  - `dry_run=false` persistindo em `company_taxes`;
  - `dry_run=true` sem persistência;
  - `raw.tax_portal_sync` com evidências da run;
  - recálculo de `status_taxas`;
  - summary da run com `field_counters`, `companies_with_debits`, `companies_marked_paid`, `filtered_out_count`, `sample_results`;
  - testes backend adicionais cobrindo persistência/regra `*` e `Pago`/metadados de `/worker/jobs`.
- Subfase B frontend concluída em 2026-03-26:
  - service frontend dedicado (`start`, `active`, `status`, `cancel`);
  - hook dedicado com polling, retomada de run ativa, loading/error e limpeza de intervalo ao desmontar;
  - manager visual inspirado no BulkSyncManager (progresso, contadores, município, dry-run, run_id, erros recentes e resumo final);
  - integração na `TaxasScreen` com RBAC (`ADMIN|DEV` inicia/cancela, `VIEW` sem ação);
  - smoke E2E Playwright: `frontend/tests_e2e/portal/taxas_tax_portal_sync.smoke.spec.ts`.

## S12 - Hardening e go-live

Status: pendente

Objetivo:
- Runbooks finais, segurança operacional e testes de regressão ampliados.

