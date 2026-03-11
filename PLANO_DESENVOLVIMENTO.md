# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referência: 2026-03-09

## Visão geral

Status global: domínio principal operacional, ingest JSON ativo, integração CertHub em produção interna e Stage S10 em evolução.

- Concluído: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Concluído: S8
- Entrega adicional concluída: bulk sync ReceitaWS (DEV)
- Em andamento: S10 (S10.1a + S10.1b + S10.2)
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

Status: EM ANDAMENTO (2026-03-09)

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

## S11 - Polimento de paridade v1

Status: pendente

Objetivo:
- Melhorias de UX, filtros avançados, paginação, ordenação e performance.

## S12 - Hardening e go-live

Status: pendente

Objetivo:
- Runbooks finais, segurança operacional e testes de regressão ampliados.

