# Plano de Desenvolvimento — eControle v2 (Rebuild)

## S0 — Kickoff e congelamento do baseline

**Objetivo:** travar o que significa “voltar até o ponto onde paramos” e evitar escopo infinito.

**Entregas**

* Lista do “ponto alvo” (telas que existiam, features mínimas, endpoints críticos).
* Inventário do que será reaproveitado do front v1 (pastas/features/componentes).
* Documento `docs/BASELINE_V1.md` com:

  * rotas de front existentes
  * domínios existentes (Empresas/Licenças/Taxas/Processos/Alertas)
  * comportamento atual esperado

**Aceite**

* “Ponto alvo” definido e versionado.

---

## S1 — Repo v2 no padrão CertHub + Infra Docker (sem conflitos de porta)

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

* `docker compose up -d` sobe Postgres e Redis.
* Backend sobe em 8020 e responde `/healthz`.

---

## S2 — Core Backend (padrão CertHub): config/logs/db/alembic/test harness

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

---

## S3 — Auth + RBAC central (eControle independente do CertHub)

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

---

## S4 — Multi-tenant e “org context” (compatível com v1)

**Objetivo:** manter o que já era bom no eControle (org_id, uniques, filtros).

**Entregas**

* `org_id` obrigatório em entidades do domínio
* filtros por org em queries
* constraints/índices por org onde necessário

**Aceite**

* Dois orgs não enxergam dados um do outro (teste automatizado básico)

---

## S5 — Domínio Core (API) no mínimo para “voltar onde parou”

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

  * `certhub_certificates_mirror`
  * `certhub_devices_mirror` (opcional)
  * `certhub_jobs_mirror` (opcional)
* Sync:

  * `POST /api/v1/integracoes/certhub/sync` (pull job)
  * registra `last_synced_at`

**Frontend**

* Aba “Certificados” em cards (como CertHub)
* Botão **Instalar** abre CertHub (deep link)

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

**Aceite**

* Worker sobe via docker
* Jobs reportam status e logs

---

## S11 — Polimento para “paridade v1” (UX, filtros, performance, índices)

**Objetivo:** voltar ao nível de usabilidade do v1, agora com base limpa.

**Entregas**

* Filtros iguais aos do v1
* Paginação, busca, ordenação
* Índices e extensões necessárias (ex.: unaccent) se fizer sentido
* Ajuste de CORS/cookies/dev

**Aceite**

* Check de paridade: lista de telas/fluxos do baseline OK

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
