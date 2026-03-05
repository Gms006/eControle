# Plano de Desenvolvimento - eControle v2 (Rebuild)

Data de referencia: 2026-03-04

## Visao geral

Status global: projeto operacional para dominio core e ingest JSON (S7), com integracao CertHub ainda incompleta.

- Concluido: S0, S1, S2, S3, S4, S5, S6, S6.1, S6.2, S7
- Em andamento parcial: S8
- Entregue adicional (ops DEV): Bulk sync ReceitaWS em lote
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

Status: concluido (2026-03-04)

Entregues:
- Persistencia de mirror local em `certificate_mirror`
- `GET /api/v1/certificados` lendo do mirror (nao placeholder)
- `POST /api/v1/certificados/sync` (ADMIN|DEV) com modo payload e modo pull (opcional por env)
- `GET /api/v1/certificados/health` com meta do mirror
- Vinculo certificado (CNPJ) -> `companies` via `company_id` (matching por digitos do CNPJ)
- Atualizacao de `company_profiles.certificado_digital` (SIM/NÃO) baseada em certificados ativos mapeados
- Deep link "Instalar" habilitado via `sha1_fingerprint`/`cert_id` (frontend consome do mirror)
- Painel e tela de Certificados consumindo payload real normalizado (snake_case/camelCase)
- E2E portal cobrindo cenário com certificado real e assert de deep link (`window.open`)
- Pull CertHub robusto com TLS configuravel (`CERTHUB_VERIFY_TLS`/`CERTHUB_CA_BUNDLE`), header `X-Org-Slug` e login automatico opcional por env

## Entrega adicional - Bulk sync ReceitaWS (DEV-only)

Status: concluido (2026-03-04)

Entregues:
- Job assinc com run persistido por org:
  - tabela `receitaws_bulk_sync_runs`
  - estados `queued/running/completed/failed/cancelled`
  - progresso `total/processed/ok/error/skipped/current`
- Endpoints DEV:
  - `POST /api/v1/dev/receitaws/bulk-sync/start`
  - `GET /api/v1/dev/receitaws/bulk-sync/active`
  - `GET /api/v1/dev/receitaws/bulk-sync/{run_id}`
  - `POST /api/v1/dev/receitaws/bulk-sync/{run_id}/cancel`
- Seguranca obrigatoria:
  - confirmacao por senha do usuario (sem persistir senha)
  - `dry_run` (default on)
  - `only_missing` (default on)
  - bloqueio de dois runs simultaneos por org
- Execucao e resiliencia:
  - rate limit configuravel por env (`RECEITAWS_MIN_INTERVAL_SECONDS`, default 20)
  - backoff para 429 (`RECEITAWS_RATE_LIMIT_BACKOFF_SECONDS`, default 60)
  - continua processamento em erro por empresa
- Frontend:
  - acao DEV no menu "ReceitaWS em lote"
  - modal de confirmacao com senha + toggles
  - janela de progresso com barra, resumo e detalhes
  - minimizacao/restauracao
  - fechar janela pede confirmacao e cancela run
  - ao clicar na acao, se existir run ativo, retoma em vez de abrir novo start

## S9 - Integracao Scribere (exports read-only)

Status: pendente

Objetivo:
- Expor exports governados no Scribere via API do eControle (somente leitura)

## S10 - Workers/Jobs/Watchers

Status: pendente

Objetivo:
- Jobs de sync/notificacao/automacoes com anti-duplicacao e observabilidade

---

## S10.1 — Licenças: Upload no portal + Padronização FS + Auto-detecção assistida

**Status:** pendente
**Contexto:** este stage complementa o **S10 — Workers/Jobs/Watchers** (pendente) com um fluxo operacional de licenças baseado em filesystem e watcher. 

### Objetivo

Permitir que o usuário **atualize licenças diretamente pelo portal**, subindo **1..N arquivos da mesma empresa**, informando (ou confirmando) **tipo** e **validade**, e fazendo o backend **salvar no diretório da empresa com nome padronizado** para que o **watcher** atualize automaticamente o vencimento/status no portal.
Adicionar **auto-detecção assistida** (sugestão de tipo/validade) baseada no conteúdo do arquivo, sempre com confirmação do usuário.

### Escopo e decisões

* Diretório padrão: `G:/EMPRESAS/{PASTA_EMPRESA}/Societário/Alvarás e Certidões/`
* Nome padronizado: `{LABEL_TIPO} - Val {DD.MM.AAAA}.{ext}` (sanitizado para Windows)
* Escrita atômica: salvar como `.tmp` e renomear para final (watcher ignora `.tmp`)
* Multi-upload permitido **somente** para a **mesma empresa** por operação
* Auto-detecção é “assistida”: sugere e o usuário confirma (sem automatizar 100%)

### Entregáveis

#### Backend (API + Services)

1. **Config**

   * `EMPRESAS_ROOT_DIR` (default: `G:/EMPRESAS`)
   * (opcional) `LICENCES_ALLOW_CREATE_MUNICIPIO_SUBDIR=false` (MVP: não criar subpasta automaticamente)

2. **Vínculo seguro empresa → pasta**

   * Campo persistido em `companies` (ex.: `fs_dirname` ou `fs_path`) para evitar depender de “Razão Social” (que pode mudar).
   * Fallback controlado (se não houver vínculo): tentativa de match normalizado com validação de match único; caso contrário, retornar erro orientando vincular a pasta.

3. **Endpoint de upload em lote**

   * `POST /api/v1/licencas/upload-bulk`

     * multipart: `company_id`, `items[]` (file + `licence_type` + `expires_at`)
   * Validações:

     * tipos permitidos (pdf/jpg/png), tamanho máximo, sem path traversal
     * todos os itens da mesma empresa
   * Comportamento:

     * resolve pasta alvo
     * grava arquivo atômico (.tmp → rename)
     * retorna lista de resultados (ok/erro por item, nome final, path relativo)

4. **Watcher/Worker**

   * Watcher no diretório das empresas (ou fila por empresa) que:

     * ignora `.tmp`
     * parseia `licence_type` + `expires_at` do nome padronizado
     * faz upsert idempotente em `company_licences`
     * registra auditoria (opcional): `licence_file_events` (filename, hash, company_id, detected_type, detected_expiry, processed_at)

5. **Auto-detecção assistida (MVP)**

   * `POST /api/v1/licencas/detect` (ou integrado no upload com flag)
   * Heurísticas:

     * extração de texto de PDF (quando possível, sem OCR)
     * regex de data por “VALIDADE / VENCIMENTO / VÁLIDO ATÉ”
     * keywords para tipo (SANITÁRIA / FUNCIONAMENTO / USO DO SOLO / BOMBEIROS / CERCON / AVCB/CLCB)
   * Retorno:

     * sugestão `licence_type`, `expires_at`, e `confidence` + “trechos” (curtos) usados como base
   * OCR fica fora do MVP (pode entrar como “V2” dentro deste stage se simples, senão vira S10.1b).

#### Frontend (Portal)

1. Botão/ação **“Atualizar licenças”** (permissão: ADMIN/DEV; VIEW não)
2. Modal/Drawer:

   * Selecionar empresa
   * Upload múltiplo
   * Grid por arquivo: tipo (dropdown), validade (date), observação opcional
   * Atalho “aplicar tipo/validade para todos”
   * Toggle “Auto-detectar” por arquivo (preenche campos, usuário confirma)
3. Progresso e resultado:

   * barra por item + resumo final
   * mensagem: “Arquivos salvos. O watcher atualizará o status em instantes.”
   * (opcional) botão “Reprocessar pasta agora” (dispara rescan leve do watcher)

#### Testes e validação

* Backend:

  * testes de path safety e escrita atômica
  * teste do endpoint upload-bulk com 2+ arquivos
  * teste do parser do watcher (tipo + `DD.MM.AAAA`)
  * teste idempotência (mesmo arquivo 2x não duplica)
* Frontend:

  * smoke Playwright: abrir modal, anexar 2 arquivos, salvar, ver sucesso
* Operacional:

  * checklist de permissões (VIEW não enxerga ação)
  * watcher ignora `.tmp` e não processa arquivo incompleto

### Critérios de aceite

* [ ] Upload de múltiplas licenças (mesma empresa) salva no FS com nome padronizado e sem caracteres inválidos
* [ ] Watcher atualiza `status` e `expires_at` no portal após detectar os arquivos
* [ ] Nenhuma possibilidade de escrita fora de `EMPRESAS_ROOT_DIR` (path traversal bloqueado)
* [ ] Auto-detecção sugere tipo/validade com “confidence” e o usuário consegue corrigir antes de salvar
* [ ] Sem duplicidade/arquivo morto no repo; build + testes passando

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
