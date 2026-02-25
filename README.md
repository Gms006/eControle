# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para acompanhamento de **empresas, licenças/certidões, taxas e processos**,
com integrações com:
- **CertHub** (certificados digitais) — eControle exibe um **espelho (read-only)** em cards e redireciona ações operacionais para o CertHub.
- **Scribere** (notas/snippets) — eControle exibe apenas exports selecionados no Scribere (read-only).

## Objetivo do Rebuild
Recriar o eControle do zero no **padrão de organização do CertHub**, voltando ao **mesmo ponto funcional do v1**
com correções de arquitetura/organização e mudanças combinadas:
- Docker-first (DX e paridade ambiente)
- Auth/RBAC no padrão CertHub (portal principal independente)
- Certificados = espelho do CertHub + “Instalar → abre CertHub”
- Úteis = exports do Scribere (notas/snippets) + “Abrir Scribere”
- Ingest inicial via **JSON** (não planilha)
**Status atual**: S7 (ingest JSON) — ingest com tracking (`ingest_runs`), idempotência e endpoints DEV-only (agregado + por dataset).  
Veja [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md) para roadmap completo e [ESTRUTURA_REPO.md](ESTRUTURA_REPO.md) para evolução da estrutura.
---

## Portas (sem conflito com CertHub)
- Frontend (Vite): **5174**
- API (FastAPI): **8020**
- Redis (host → container): **6381 → 6379**
- Postgres (host → container): **5434 → 5432**

## Configuração (env)
O backend monta `DATABASE_URL` automaticamente a partir de:
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
Se precisar sobrescrever, defina essas variáveis no `.env` (na raiz) ou em `backend/.env`.

### Auth (S3)
- `SECRET_KEY` (obrigatório fora de `ENV=dev`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default 14)
- `SEED_ENABLED` (default true em dev)
- `SEED_ORG_NAME` (default "Neto Contabilidade")
- `MASTER_EMAIL` (default "admin@example.com")
- `MASTER_PASSWORD` (default "admin123")
- `MASTER_ROLES` (default "DEV,ADMIN")

### UTF-8 (Windows)
Para evitar problemas de encoding (acentos) durante ingest/execuções administrativas:
```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
```

### S7 - Ingest JSON (DEV-only)
```powershell
docker compose -f infra/docker-compose.yml up -d
cd backend
alembic upgrade head
pytest -q
cd ..

$env:ECONTROLE_EMAIL="seu_email"
$env:ECONTROLE_PASSWORD="sua_senha"
.\scripts\s7_validate_ingest.ps1
```

Endpoints S7 (estado atual):
- `POST /api/v1/ingest/run` (agregado: companies + profiles + datasets relacionados no envelope)
- `POST /api/v1/ingest/licences` (ingest separado)
- `POST /api/v1/ingest/taxes` (ingest separado)
- `POST /api/v1/ingest/processes` (ingest separado)

Observações:
- Todas as rotas de ingest exigem papel `DEV`.
- O script `scripts/s7_validate_ingest.ps1` valida o fluxo agregado (`/api/v1/ingest/run`) e a idempotência (2 execuções).
- O tracking de execuções fica em `ingest_runs` (`dataset`, `source_hash`, `stats`, `status`).

### E2E
```powershell
# Roda: migrations + pytest rápido + E2E da API (HTTP real)
.\scripts\e2e_run.ps1 -Email "seu_email" -Password "sua_senha"
```

---

## Org Context (S4)
Requests autenticadas podem enviar **header opcional** `X-Org-Id` ou `X-Org-Slug`.
Por enquanto o usuário pertence a **uma única org**:
- Se o header for omitido, usa `user.org_id`.
- Se o header for enviado e não bater com a org do usuário, retorna **403**.

Endpoints novos:
- `GET /api/v1/orgs/current`
- `GET /api/v1/orgs/list` (ADMIN/DEV)

## Companies (S5)
CRUD básico com isolamento por `org_id` (filtro obrigatório) e RBAC:
- `POST /api/v1/companies` (ADMIN/DEV)
- `GET /api/v1/companies` (ADMIN/DEV/VIEW)
- `GET /api/v1/companies/{id}` (ADMIN/DEV/VIEW)
- `PATCH /api/v1/companies/{id}` (ADMIN/DEV)

Exemplos PowerShell (Invoke-RestMethod):
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
$company.id

# List (filtros opcionais: cnpj, razao_social, is_active, limit, offset)
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/companies?razao_social=Alpha" -Headers @{
  Authorization = "Bearer $token"
}

# Get by id
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/companies/$($company.id)" -Headers @{
  Authorization = "Bearer $token"
}

# Patch (update / delete lógico com is_active=false)
Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/v1/companies/$($company.id)" -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  razao_social = "Empresa Alpha Atualizada"
  is_active = $false
} | ConvertTo-Json) -ContentType "application/json"
```

## Primeiro boot (dev)

**Fluxo recomendado para zerar o banco e deixar o projeto pronto:**

```bash
# 1) Subir infraestrutura
docker compose -f infra/docker-compose.yml up -d

# 2) Instalar dependências
python -m pip install -r requirements.txt
cd backend

# 3) Executar migrations (zera + cria schema limpo)
python -m alembic upgrade head

# 4) Seed automático (usuário master)
# Certifique-se de ter no .env:
#   SEED_ENABLED=true
#   MASTER_EMAIL=cadastro@netocontabilidade.com.br
#   MASTER_PASSWORD=Dev@12345
#   MASTER_ROLES=DEV,ADMIN

# 5) Iniciar backend
uvicorn main:app --reload --host 0.0.0.0 --port 8020

# 6) Em outro terminal, subir frontend
cd frontend
npm install
npm run dev
```

### Login e Teste de Endpoints (PowerShell 5.1)

> **Prefira `Invoke-RestMethod` ao curl** — melhor integração com dados JSON/PowerShell.

```powershell
$baseUrl = "http://localhost:8020"

# Login com usuário master
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email = "cadastro@netocontabilidade.com.br"
    password = "Dev@12345"
  } | ConvertTo-Json -Compress)

$token = $login.access_token

# Teste admin ping (ADMIN/DEV)
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/auth/admin/ping" `
  -Headers @{ Authorization = "Bearer $token" }

# Listar usuários da org
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/admin/users?limit=50" `
  -Headers @{ Authorization = "Bearer $token" }

# Criar novo usuário
$newUser = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/admin/users" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{
    email = "user@netocontabilidade.com.br"
    password = "Temp@54321"
    roles = @("VIEW")
  } | ConvertTo-Json -Compress)

# Atualizar usuário (roles e status)
Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/v1/admin/users/$($newUser.id)" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{
    roles = @("DEV", "ADMIN")
    is_active = $true
  } | ConvertTo-Json -Compress)
```

---

## Rodar local (Docker-first)

### 1) Subir infraestrutura (Postgres + Redis)
```bash
docker compose -f infra/docker-compose.yml up -d
````

### 2) Subir Backend (API)

```bash
python -m pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8020
```

Testar healthchecks:
```bash
curl http://localhost:8020/healthz
curl http://localhost:8020/api/v1/worker/health
```

Testar auth (S3):
```bash
curl -X POST http://localhost:8020/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

curl http://localhost:8020/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

curl -X POST http://localhost:8020/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'

curl -X POST http://localhost:8020/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'
```

Testar org context (S4):
```bash
curl http://localhost:8020/api/v1/orgs/current \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

curl http://localhost:8020/api/v1/orgs/current \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "X-Org-Id: <ORG_ID>"

curl http://localhost:8020/api/v1/orgs/list \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

> Se o backend for rodado via docker-compose no futuro (recomendado), este README será atualizado com o serviço api.

### 3) Subir Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Arquitetura (alto nível)

* `backend/` — FastAPI (padrão CertHub): estrutura expandível com `app/core`, `app/api/v1`, `app/db`, `app/models`, `app/schemas`, `app/services`, `app/workers`
  - Em S1: `main.py` com healthchecks (inicia estrutura modular)
* `frontend/` — React/Vite (reaproveita v1 ao máximo) - adicionada em S2+
* `infra/` — docker-compose (Postgres + Redis)
* `docs/` — baseline do v1, contratos de integração, riscos/decisões e checklist

---

## Integrações

### CertHub (Certificados)

* eControle mantém tabelas espelho (read-model) com metadados.
* Sincronização via job/endpoint de sync.
* UI em cards “como no CertHub”.
* Botão “Instalar” sempre redireciona para o CertHub.

### Scribere (Úteis)

* No Scribere, usuário marca quais notas/snippets devem aparecer no eControle (exports).
* eControle consome e exibe conteúdo (read-only), com visualizador.
* Botão “Abrir Scribere” para editar/configurar exports.

---

## Documentação essencial

* `docs/BASELINE_V1.md` — ponto alvo de paridade (v1)
* `docs/REUSE_FRONTEND_MAP.md` — o que reaproveitar do frontend
* `docs/INTEGRATION_CONTRACTS.md` — contratos CertHub/Scribere
* `docs/RISKS_AND_DECISIONS_S0.md` — decisões travadas e riscos
* `docs/S0_CHECKLIST.md` — checklist do S0

---

## Segurança & Governança

* Espelho do CertHub não armazena PFX/senhas.
* Exports do Scribere são read-only no eControle.
* Multi-tenant por `org_id` em todas entidades do domínio.

---

## Licença

Uso interno (Neto Contabilidade).

---

## E2E Full (API + Portal)

Fluxo automatizado para validar infra, backend (HTTP real) e portal (Playwright) no Windows PowerShell:

* `scripts\e2e_run_full.ps1`

### Pré-requisitos

* Docker Desktop em execução
* Python 3.10 (preferencialmente `.venv`) com dependências do backend instaladas
* Node 18+ com dependências do `frontend` instaladas
* Playwright instalado no frontend (`npm install` e `npx playwright install chromium`)

### Variáveis de ambiente (obrigatórias para credenciais)

```powershell
$env:ECONTROLE_EMAIL = "dev@example.com"
$env:ECONTROLE_PASSWORD = "dev123"
```

### Variáveis de ambiente (opcionais)

```powershell
$env:ECONTROLE_E2E_API_BASE_URL = "http://127.0.0.1:8020"
$env:ECONTROLE_E2E_PORTAL_BASE_URL = "http://127.0.0.1:5174"
```

### Execução

```powershell
.\scripts\e2e_run_full.ps1
```

### O que o script faz

* `chcp 65001` + UTF-8
* `docker compose up -d` em `infra/docker-compose.yml` (Postgres/Redis)
* `alembic upgrade head` (backend)
* `pytest -q` (backend)
* sobe `uvicorn main:app` na porta `8020` e aguarda `/healthz`
* roda `pytest -m e2e` em `tests_e2e/api`
* sobe portal (`vite`) e aguarda `/login`
* roda Playwright (`frontend/tests_e2e/portal`)
* encerra `uvicorn` e portal no `finally`
