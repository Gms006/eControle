# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referência: 2026-03-09

## Visão geral

Status global: domínio principal operacional, ingest JSON ativo, integração CertHub em produção interna e Stage S10 em evolução.

- Concluído: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Concluído: S8
- Entrega adicional concluída: bulk sync ReceitaWS (DEV)
- Em andamento: S10 (S10.1a + S10.1b + S10.2 concluídos; S10.3 fase 3 concluída)
- Pendente: S9, S11, S12

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

## S11 - Polimento de paridade v1

Status: pendente

Objetivo:
- Melhorias de UX, filtros avançados, paginação, ordenação e performance.

## S12 - Hardening e go-live

Status: pendente

Objetivo:
- Runbooks finais, segurança operacional e testes de regressão ampliados.

