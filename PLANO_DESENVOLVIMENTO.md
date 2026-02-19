# Plano de Desenvolvimento — eControle v2 (Rebuild)

## S0 — Kickoff e Baseline (Concluído)
**Status:** ✅ Concluído em 2026-02-11

**Objetivo:** travar o que significa “voltar até o ponto onde paramos” e evitar escopo infinito.

**Checklist — Entregáveis localizados (✅)**

✅ `docs/BASELINE_V1.md`  
✅ `docs/REUSE_FRONTEND_MAP.md`  
✅ `docs/INTEGRATION_CONTRACTS.md`  
✅ `docs/RISKS_AND_DECISIONS_S0.md`

**Links/paths esperados para o S0**

* `docs/BASELINE_V1.md`
* `docs/REUSE_FRONTEND_MAP.md`
* `docs/INTEGRATION_CONTRACTS.md`
* `docs/RISKS_AND_DECISIONS_S0.md`
* `docs/S0_CHECKLIST.md`

**Resumo (S0)**

* Ponto alvo de paridade (v1): abas, fluxos e endpoints mapeados no baseline v1 para orientar a volta ao mesmo comportamento.
* Reuso do frontend: mapa de reuso aponta reaproveitamento amplo com mudanças mínimas para auth, baseURL e abas integradas.
* Decisões travadas: Docker-first, portas fixas, auth/RBAC no padrão CertHub, Certificados read-only e Uteis via exports.
* Contratos de integração CertHub/Scribere: mirror read-only no eControle, deep link configurável e exports de notes/snippets.
* Riscos e mitigação: riscos de auth/CORS, espelho stale e segurança de exports, com mitigação documentada.
* CertHub deep link: base e path configuráveis com fallback quando não suportado.
* Scribere: read-only e filtragem por escopo `private`/`org` com sanitização no render.
* Painel do eControle manterá lista de certificados vencidos/próximos usando mirror local do CertHub; notificações serão disparadas por jobs no worker com log anti-duplicação.

## S0 Checklist

✅ Baseline definido e revisado
✅ Mapa de reuse do front completo
✅ Contratos de integracao definidos
✅ Contrato Scribere = notes/snippets (sem file_url)
✅ Decisoes e riscos documentados

---

## S1 — Repo v2 no padrão CertHub + Infra Docker (sem conflitos de porta)
**Status:** ✅ Concluído em 2026-02-12

**Objetivo:** criar o esqueleto limpo e reproduzível (DX).

**Entregas**

* Monorepo `eControle/` com `backend/ frontend/ infra/ docs/ scripts/`.
* `infra/docker-compose.yml` (Postgres + Redis) com portas:

  * front **5174**
  * API **8020**
  * Redis **6381:6379**
  * Postgres **5433:5432**
* `.env.example` (sem Excel)
* Healthchecks:

  * `GET /healthz`
  * `GET /api/v1/worker/health` (stub por enquanto)

**Aceite**

diff --git a/PLANO_DESENVOLVIMENTO.md b/PLANO_DESENVOLVIMENTO.md
--- a/PLANO_DESENVOLVIMENTO.md
+++ b/PLANO_DESENVOLVIMENTO.md
@@
 ## S1 — Repo v2 no padrão CertHub + Infra Docker (sem conflitos de porta)
 
+**Status:** ✅ Concluído em 2026-02-12
+
 **Objetivo:** criar o esqueleto limpo e reproduzível (DX).
 
@@
 **Aceite**
 
* Infra sobindo via Docker Compose com containers `healthy`.
* Postgres do eControle exposto em **5434:5432** (evita conflito com CertHub em 5433).
* Redis do eControle exposto em **6381:6379** (CertHub usa 6379).
* Backend sobe em **8020** e responde:
  - `GET /healthz` => 200
  - `GET /api/v1/worker/health` => 200
 
**Evidências (execução local em 2026-02-12)**

```text
econtrole-postgres   Up (healthy)   0.0.0.0:5434->5432/tcp
econtrole-redis      Up (healthy)   0.0.0.0:6381->6379/tcp
certhub-postgres     Up             127.0.0.1:5433->5432/tcp
certhub-redis        Up (healthy)   127.0.0.1:6379->6379/tcp

psql -U postgres -c "select 1;"  => 1 row
redis-cli ping => PONG
GET /healthz => 200 {"status":"ok"}
GET /api/v1/worker/health => 200 {"status":"ok","worker":"stub"}
```

**Comandos de validação**
```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -c "select 1;"
docker compose -f infra/docker-compose.yml exec -T redis redis-cli ping

cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8020
```

**Rollback (infra)**
```bash
docker compose -f infra/docker-compose.yml down -v
```

Testar:

```bash
curl http://localhost:8020/healthz
curl http://localhost:8020/api/v1/worker/health
```
---

## S2 — Core Backend (padrão CertHub): config/logs/db/alembic/test harness

**Status:** ✅ Concluído em 2026-02-18

**Objetivo:** base sólida para não virar “frankenstein”.

**Entregas**

* `backend/app/core/` (config, logging, security base, audit base)
* `backend/app/db/` (session/base)
* Alembic configurado
* Pytest rodando (smoke test)
* CORS alinhado com front 5174

**Aceite**

* `alembic upgrade head` OK
* `pytest` OK (mesmo que só smoke)

**Validação (local)**

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend
alembic upgrade head
pytest -q
```

---

## S3 — Auth + RBAC central (eControle independente do CertHub)

**Status:** ✅ Concluído em 2026-02-18

**Objetivo:** eControle ser “portal principal” sem depender do CertHub estar online.

**Modelo**

* **Mesma lógica do CertHub** (endpoints + RBAC DEV/ADMIN/VIEW).
* Fonte de verdade: **tabelas de auth** compartilhadas (ou schema auth comum).
* eControle valida login/refresh localmente (no próprio backend).

**Entregas**

* Endpoints:

  * `POST /api/v1/auth/login`
  * `POST /api/v1/auth/refresh`
  * `POST /api/v1/auth/logout`
  * `GET /api/v1/auth/me`
* Guards/Deps RBAC no padrão CertHub
* Seed de `ORG` + `MASTER_USER` por env (dev)

**Aceite**

* Login real funcionando no eControle (sem token mint manual)
* Rotas protegidas e RBAC aplicado

**Validação (local)**

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend
alembic upgrade head
pytest -q
```

```bash
curl -X POST http://localhost:8020/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Copie o access_token para testar /me
curl http://localhost:8020/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## S4 — Multi-tenant e “org context” (compatível com v1)

**Status:** ✅ Concluído em 2026-02-19

**Objetivo:** manter o que já era bom no eControle (org_id, uniques, filtros).

**Entregas**

* Org context obrigatório para operações de negócio
* Header opcional `X-Org-Id`/`X-Org-Slug` validado contra `user.org_id`
* `GET /api/v1/orgs/current` (auth)
* `GET /api/v1/orgs/list` (ADMIN/DEV)
* Migration incremental de org (slug unique + updated_at)

**Aceite**

* `/api/v1/orgs/current` retorna org do usuário autenticado
* Header `X-Org-Id` divergente retorna **403**
* RBAC continua funcionando
* `alembic upgrade head` OK
* `pytest -q` OK

**Validação (local)**

```bash
cd backend
alembic upgrade head
pytest -q
```

```bash
curl -X POST http://localhost:8020/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

curl http://localhost:8020/api/v1/orgs/current \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

curl http://localhost:8020/api/v1/orgs/current \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Org-Id: <ORG_ID_INVALIDO>"

curl http://localhost:8020/api/v1/orgs/list \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## S5 — Domínio Core (API) no mínimo para “voltar onde parou”

**Status:** ✅ Concluído em 2026-02-19

**Objetivo:** reimplantar o coração do eControle com estabilidade.

**Entregas (mínimo)**

* CRUD + filtros:

  * Empresas
  * Licenças/Certidões
  * Taxas
  * Processos
* KPIs/alertas (mesmo que simples inicialmente)
* Auditoria mínima em ações (create/update)

**Aceite**

* Front (mesmo antigo) consegue listar e operar o core sem gambiarra

**Validação (local)**

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend
alembic upgrade head
alembic current
alembic heads
cd ..
pytest -q
```

**Smoke (PowerShell)**

```powershell
$baseUrl = "http://localhost:8020"
$token = (Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" -Body (@{
  email = "admin@example.com"
  password = "admin123"
} | ConvertTo-Json) -ContentType "application/json").access_token

# Create
$company = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/companies" -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  cnpj = "12.345.678/0001-90"
  razao_social = "Empresa Alpha"
  nome_fantasia = "Alpha"
  municipio = "Sao Paulo"
  uf = "SP"
} | ConvertTo-Json) -ContentType "application/json"

# List (filtro por razao_social)
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/companies?razao_social=Alpha" -Headers @{
  Authorization = "Bearer $token"
}

# Get by id
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/companies/$($company.id)" -Headers @{
  Authorization = "Bearer $token"
}

# Patch (delete lógico)
Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/v1/companies/$($company.id)" -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  is_active = $false
} | ConvertTo-Json) -ContentType "application/json"
```

---

## S6 — Frontend reaproveitado (migração mínima)

**Objetivo:** reaproveitar “principalmente frontend”, ajustando só base URL, auth e abas integradas.

**Entregas**

* Front v1 reaproveitado (features/telas)
* Ajuste de:

  * porta 5174
  * API base para 8020 (ou proxy)
  * fluxo de login (agora real)
* AppShell coerente (padrão CertHub se quiser, mas sem refazer UI inteira)

**Aceite**

* Tela inicial e navegação funcionando
* Login e sessão funcionando

---

## S7 — Ingest inicial por JSON (substitui planilha/ETL antigo)

**Objetivo:** popular o sistema sem depender de Excel e preservando idempotência.

**Entregas**

* Contratos `schemas/ingest/*.py`
* Runner:

  * `POST /api/v1/ingest/run` (dev) ou comando `python -m ingest`
* Upserts idempotentes com tracking:

  * `source_file`, `source_hash`, `ingested_at`
* Datasets iniciais:

  * `empresas.json`
  * `licencas.json`
  * `taxas.json`
  * `processos.json`

**Aceite**

* Rodar ingest duas vezes não duplica dados
* Log/audit de ingest OK

---

## S8 — Integração CertHub: espelho de Certificados (Cards) + “Instalar → abre CertHub”

**Objetivo:** substituir a aba Certificados do eControle sem reimplementar o CertHub.

**Modelo**

* Read-model local (mirror) no eControle:

  * `certhub_certificates_mirror` deve conter no mínimo:

  * `org_id`
  * `certhub_cert_id` (nullable) **e/ou** `sha1_fingerprint` (preferido)
  * `subject`, `cnpj` (se existir no subject/metadata)
  * `not_before`, `not_after`
  * `status` (OK/VENCENDO/VENCIDO) *(opcional, pode calcular)*
  * `last_seen_at` *(se disponível)*
  * `devices_count` *(se disponível)*
  * `synced_at`

* **Controle de sincronização**

* tabela `integrations_sync_state` (ou equivalente) contendo:

  * `org_id`
  * `integration = 'certhub'`
  * `last_synced_at`
  * `last_sync_status` (ok/stale/error)
  * `last_sync_error` (nullable)

* **Endpoints (painel + mirror)**

* `POST /api/v1/integracoes/certhub/sync` (dispara sync e atualiza `sync_state`)
* `GET /api/v1/certificados` (lista do espelho com filtros)
* **NOVO: `GET /api/v1/dashboard/certificados-alertas?days=30&critical=7`**

  * retorna:

    * `expired[]` (days_to_expire < 0)
    * `critical[]` (0..critical)
    * `upcoming[]` (0..days)
    * `last_synced_at`
  * `certhub_devices_mirror` (opcional)
  * `certhub_jobs_mirror` (opcional)
* Sync:

  * `POST /api/v1/integracoes/certhub/sync` (pull job)
  * registra `last_synced_at`

**Frontend**

* Aba Certificados em **cards** (espelhado do CertHub)
* Botão “Instalar” = **deep link para o CertHub** (`CERTHUB_BASE_URL + CERTHUB_CERTS_PATH?install=<fingerprint|id>`)
* **Painel/Dashboard:** manter tabela “Vencidos / Próximos do vencimento” consumindo `GET /dashboard/certificados-alertas`

### Critérios de aceite do S8

* Painel exibe:

  * vencidos
  * vencendo em **≤7 dias**
  * vencendo em **≤30 dias** (config)
  * “Última sync”
* Aba Certificados funciona **sem o CertHub online** (dados do espelho + timestamp)
* Instalar sempre redireciona para o CertHub (sem operação local)

**Aceite**

* Aba Certificados funciona mesmo se CertHub cair (mostra último espelho + “última sync”)
* Instalar sempre redireciona ao CertHub

---

## S9 — Integração Scribere: “Exports” controlados no Scribere + visualização no eControle

**Objetivo:** substituir “Úteis (Modelos/Contatos)” por conteúdo governado no Scribere.

**Modelo**

* No Scribere: marcações do que é exportável (flag/tabela `exports`)
* No eControle: endpoint que lê “exports” e exibe (somente leitura)

**Entregas**

* eControle:

  * `GET /api/v1/integracoes/scribere/exports`
  * `GET /api/v1/integracoes/scribere/exports/:id`
* Front:

  * lista + filtros
  * visualizador
  * botão “Abrir Scribere” e “Configurar exports”

**Aceite**

* Só aparece no eControle o que foi marcado no Scribere
* Sem edição pelo eControle (apenas consumo)

---

## S10 — Workers/Jobs/Watchers (apenas do que ainda pertence ao eControle)

**Objetivo:** recuperar automações úteis sem duplicar CertHub/Scribere.

**Entregas**

* RQ worker e filas do eControle
* Jobs do eControle:

  * ingest agendado (se quiser)
  * sync CertHub/Scribere
  * automações CND/CAE (se mantidas)
* Observabilidade e logs
* **Tabelas de regras e log (anti-spam)**

* `certificate_notification_rules`

  * `org_id`
  * `enabled` (bool)
  * `threshold_days` (int) — ex.: 30, 15, 7, 1, 0
  * `channels` (json/array: `email`, `whatsapp`, `in_app`)
  * `recipients` (json/array; emails/telefones)
  * `created_at`, `updated_at`

* `certificate_notification_log`

  * `org_id`
  * `certificate_ref` (fingerprint ou certhub_cert_id)
  * `threshold_days`
  * `channel`
  * `sent_at`
  * `payload_hash` (opcional)
  * índice único recomendado:

    * (`org_id`, `certificate_ref`, `threshold_days`, `channel`, `date(sent_at)`) *(para evitar repetir no mesmo dia)*

* **Job de notificação**

* Job: `certificates_renewal_notify`

  * roda **diariamente** (ou 6/6h em dev)
  * busca certificados no mirror
  * calcula `days_to_expire`
  * para cada regra ativa:

    * seleciona os certificados que batem no threshold
    * checa `notification_log` antes de enviar
    * envia e registra

* **Canais (mínimo no v1 do sistema)**

* Implementar **e-mail primeiro**
* WhatsApp e in-app ficam “pluggable” (stubs/pendentes)

* **Config/Env**

* `CERT_NOTIFY_DEFAULT_THRESHOLDS=30,7,0` (opcional)
* `CERT_NOTIFY_EMAIL_FROM=...`
* `CERT_NOTIFY_EMAIL_PROVIDER=...` (smtp/sendgrid)
* `CERTHUB_BASE_URL` para link no corpo do e-mail

* **Observabilidade**

* logs por execução:

  * quantos certificados avaliados
  * quantos enviados
  * por threshold/canal

### Critérios de aceite do S10

* Job roda no Docker (worker) e registra execução
* Não envia duplicado (log impede)
* Template do e-mail inclui:

  * Empresa
  * Data de vencimento
  * Dias restantes
  * Botão/link “Abrir no CertHub” (deep link)
* Regras por org funcionando (pelo menos seed default)

---

## S11 — Polimento para “paridade v1” (UX, filtros, performance, índices)

**Objetivo:** voltar ao nível de usabilidade do v1, agora com base limpa.

**Entregas**

* Filtros iguais aos do v1
* Paginação, busca, ordenação
* Índices e extensões necessárias (ex.: unaccent) se fizer sentido
* Ajuste de CORS/cookies/dev

### Melhorias de UX do Painel de Certificados

* filtros rápidos no painel:

  * “Somente críticos (≤7)”
  * “Somente vencidos”
* configuração por org (UI simples):

  * editar thresholds (30/15/7/1/0)
  * editar destinatários
* “silenciar por X dias” (opcional)

### Critérios de aceite do S11

* Check de paridade: lista de telas/fluxos do baseline OK
* Usuário admin consegue ajustar thresholds/recipients (ou via seed/env no mínimo)
* Painel com filtros rápidos e paginação se necessário

---

## S12 — Hardening e Go-live (segurança, testes, runbooks)

**Objetivo:** deixar “operável” como o CertHub.

**Entregas**

* Testes:

  * auth/rbac
  * multi-tenant
  * ingest idempotente
  * integração sync
* Runbooks:

  * subir stack
  * reset/seed
  * troubleshooting
* Auditoria final e rate limit (se necessário)

**Aceite**

* Smoke tests passam
* Documentação mínima para manutenção
