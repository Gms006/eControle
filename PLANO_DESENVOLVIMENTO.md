# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referência: 2026-03-09

## Visão geral

Status global: domínio principal operacional, ingest JSON ativo, integração CertHub em produção interna e Stage S10 em evolução.

- Concluído: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Concluído: S8
- Entrega adicional concluída: bulk sync ReceitaWS (DEV)
- Em andamento: S10 (S10.1a + S10.1b + S10.2)
- Pendente: S9, S11, S12

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

