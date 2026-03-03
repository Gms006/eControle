# Estrutura do Repositório — eControle v2 (Rebuild)

Padrão inspirado no CertHub: monorepo com backend modular, frontend isolado e testes E2E integrados.

## Tree (atual — S7 + E2E)
### Detalhamento Completo
> Domínio core + ingest JSON com tracking (`ingest_runs`) e endpoints separados por dataset (`licences/taxes/processes`). Testes E2E com Playwright e pytest para validação de fluxos completos.

```
eControle/
├─ backend/
│  ├─ app/
│  │  ├─ __init__.py
│  │  ├─ api/
│  │  │  ├─ __init__.py
│  │  │  └─ v1/
│  │  │     ├─ __init__.py
│  │  │     ├─ api.py
│  │  │     └─ endpoints/
│  │  │        ├─ __init__.py
│  │  │        ├─ admin_users.py
│  │  │        ├─ auth.py
│  │  │        ├─ companies.py
│  │  │        ├─ ingest.py
│  │  │        └─ orgs.py
│  │  ├─ core/
│  │  │  ├─ __init__.py
│  │  │  ├─ audit.py
│  │  │  ├─ config.py
│  │  │  ├─ logging.py
│  │  │  ├─ org_context.py
│  │  │  └─ security.py
│  │  ├─ db/
│  │  │  ├─ __init__.py
│  │  │  ├─ base.py
│  │  │  └─ session.py
│  │  ├─ models/
│  │  │  ├─ __init__.py
│  │  │  ├─ company.py
│  │  │  ├─ company_licence.py
│  │  │  ├─ company_process.py
│  │  │  ├─ company_profile.py
│  │  │  ├─ company_tax.py
│  │  │  ├─ ingest_run.py
│  │  │  ├─ org.py
│  │  │  ├─ refresh_token.py
│  │  │  ├─ role.py
│  │  │  └─ user.py
│  │  ├─ schemas/
│  │  │  ├─ __init__.py
│  │  │  ├─ admin_users.py
│  │  │  ├─ auth.py
│  │  │  ├─ company.py
│  │  │  ├─ ingest/
│  │  │  │  ├─ __init__.py
│  │  │  │  ├─ common.py
│  │  │  │  ├─ companies.py
│  │  │  │  ├─ envelopes.py
│  │  │  │  ├─ licences.py
│  │  │  │  ├─ processes.py
│  │  │  │  └─ taxes.py
│  │  │  ├─ org.py
│  │  │  ├─ token.py
│  │  │  └─ user.py
│  │  ├─ services/
│  │  │  ├─ __init__.py
│  │  │  └─ ingest/
│  │  │     ├─ __init__.py
│  │  │     ├─ companies.py
│  │  │     ├─ company_profiles.py
│  │  │     ├─ licences.py
│  │  │     ├─ processes.py
│  │  │     ├─ run.py
│  │  │     ├─ taxes.py
│  │  │     └─ utils.py
│  │  └─ static/
│  ├─ alembic/
│  │  ├─ env.py
│  │  ├─ script.py.mako
│  │  └─ versions/
│  │     ├─ 20260218_0001_create_orgs.py
│  │     ├─ 20260218_0002_auth_tables.py
│  │     ├─ 20260218_0003_orgs_slug_updated_at.py
│  │     ├─ 20260219_0004_create_companies.py
│  │     ├─ 20260224_0005_create_ingest_runs.py
│  │     ├─ 20260224_0006_create_company_profiles.py
│  │     └─ 20260224_0007_create_licences_taxes_processes.py
│  ├─ tests/
│  │  ├─ conftest.py
│  │  ├─ test_auth_login_me.py
│  │  ├─ test_auth_rbac.py
│  │  ├─ test_auth_refresh_logout.py
│  │  ├─ test_companies_crud.py
│  │  ├─ test_extra_endpoints.py
│  │  ├─ test_health.py
│  │  ├─ test_ingest_s7.py
│  │  ├─ test_ingest_s7_full.py
│  │  ├─ test_org_context.py
│  │  └─ __pycache__/
│  ├─ alembic.ini
│  ├─ download_redoc_assets.py
│  ├─ main.py
│  ├─ pytest.ini
│  ├─ REDOC_SELFHOST.md
│  ├─ tmp_psql.txt
│  └─ __pycache__/
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  ├─ index.css
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  ├─ pages/
│  │  ├─ providers/
│  │  └─ services/
│  ├─ tests_e2e/
│  │  └─ portal/
│  │     └─ login_empresas.smoke.spec.ts
│  ├─ index.html
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ playwright.config.ts
│  ├─ postcss.config.cjs
│  ├─ tailwind.config.js
│  ├─ tsconfig.json
│  ├─ tsconfig.tsbuildinfo
│  ├─ vite.config.ts
│  ├─ test-results/
│  └─ __pycache__/ (opcional)
├─ tests_e2e/
│  └─ api/
│     └─ test_api_ingest_e2e.py
├─ docs/
│  ├─ BASELINE_V1.md
│  ├─ INTEGRATION_CONTRACTS.md
│  ├─ REUSE_FRONTEND_MAP.md
│  ├─ RISKS_AND_DECISIONS_S0.md
│  ├─ S6_FRONTEND_REAPROVEITADO.md
│  ├─ S6_INDEX.md
│  ├─ S6_PATCHES_E_CHECKLIST.md
│  ├─ S6_RESUMO_EXECUTIVO.md
│  └─ ingest_jsons/
│     ├─ empresas_v2.json
│     ├─ licencas_v2.json
│     ├─ processos_v2.json
│     └─ taxas_v2.json
├─ scripts/
│  ├─ datasets/
│  │  ├─ companies_ingest_model.json
│  │  ├─ companies_json_creator.py
│  │  ├─ ingest_content.txt
│  │  ├─ licences_ingest_model.json
│  │  ├─ licences_json_creator.py
│  │  ├─ processes_ingest_model.json
│  │  ├─ processes_json_creator.py
│  │  ├─ taxes_ingest_model.json
│  │  └─ taxes_json_creator.py
│  ├─ e2e_run_full.ps1
│  └─ s7_validate_ingest.ps1
├─ infra/
│  └─ docker-compose.yml
├─ ESTRUTURA_REPO.md
├─ PLANO_DESENVOLVIMENTO.md
├─ README.md
├─ requirements.txt
├─ pytest.ini
├─ patch.diff
└─ node_modules/ (opcional, frontend dependencies)
```


## Quick Reference

| Aspecto | Localização |
|---------|-------------|
| **API Principal** | `backend/app/api/v1/` |
| **Modelos** | `backend/app/models/` |
| **Esquemas** | `backend/app/schemas/` |
| **Lógica de Negócio** | `backend/app/services/ingest/` |
| **Testes Backend** | `backend/tests/` |
| **Frontend Principal** | `frontend/src/` |
| **Componentes** | `frontend/src/components/` |
| **Páginas** | `frontend/src/pages/` |
| **Testes Frontend** | `frontend/tests_e2e/` |
| **Testes E2E API** | `tests_e2e/api/` |
| **Migrações DB** | `backend/alembic/versions/` |
| **Documentação Técnica** | `docs/` |
| **Scripts Utilitários** | `scripts/` |

## Atualizações S6.2 (2026-02-27)
- Novo helper backend de normalização: `backend/app/core/normalization.py` (title case, município, e-mail, telefone).
- Novo módulo canônico de normalização: `backend/app/core/normalize.py` (whitespace/documentos/status/município + labels canônicos).
- Migração de schema: `backend/alembic/versions/20260227_0009_add_cnaes_to_company_profiles.py`.
- Migração de dados: `backend/alembic/versions/20260227_0010_normalize_municipios_existing_data.py`.
- Migração de dados: `backend/alembic/versions/20260227_0011_normalize_process_situacao_canonical.py`.
- Migração de dados: `backend/alembic/versions/20260227_0012_normalize_all_status_fields_canonical.py`.
- Migração de dados: `backend/alembic/versions/20260227_0013_refine_municipios_preserve_accents.py`.
- `company_profiles` agora suporta CNAEs estruturados (`cnaes_principal`, `cnaes_secundarios`).
- Lookup ReceitaWS expandido em `backend/app/api/v1/endpoints/lookups.py`.
- Novo endpoint de enums canônicos: `backend/app/api/v1/endpoints/meta.py` (`GET /api/v1/meta/enums`).
- Novo helper frontend: `frontend/src/lib/normalization.js`.
- Novo helper frontend de datas: `frontend/src/lib/date.js`.
- Novo helper frontend de Taxas: `frontend/src/lib/taxes.js` (parse/format de `data_envio` com método(s) de envio).
- Novo conjunto de primitives de formulário: `frontend/src/components/forms/DrawerFormPrimitives.jsx`.
- Novo input de data BR reutilizável: `frontend/src/components/forms/BrDateInput.jsx`.
- Novo componente UI: `frontend/src/components/ui/textarea.jsx`.
- Drawer de Empresa (novo estilo lateral no HeaderMenu): `frontend/src/components/HeaderMenuPro.jsx`.
- Novo smoke E2E portal: `frontend/tests_e2e/portal/company_import_save.smoke.spec.ts`.


## Convenções

### Backend
- Rotas sempre em `/api/v1/*`
- `core/` para config, segurança (JWT, cookies), auditoria e logs
- `services/` para regras de domínio, processamento de ingest e transformações
- `models/` definem o esquema ORM SQLAlchemy
- `schemas/` definem validação Pydantic (read/write)
- `alembic/` controla versionamento de schema do banco

### Frontend
- `src/pages` contém as telas/abas principais (React/TypeScript)
- `src/components` contém componentes reutilizáveis
- `src/api` contém clientes HTTP e integração com backend
- `src/hooks` contém custom hooks
- `src/lib` contém utilitários e helpers
- `src/providers` contém contextos React
- `src/services` contém lógica de negócio compartilhada
- Tooling: Vite, Tailwind CSS, TypeScript strict

### Testes
- **Unit/Integration (Backend)**: `backend/tests/` com pytest
  - Fixtures em `conftest.py`
  - Coverage de auth, RBAC, CRUD, ingest
- **E2E API**: `tests_e2e/api/test_api_ingest_e2e.py` com pytest HTTP real
- **E2E Portal**: `frontend/tests_e2e/portal/` com Playwright
  - Smoke tests de login e navegação
  - Seletores: `data-testid="..."`

## Integrações e Assets

### Utilitários
- `backend/download_redoc_assets.py`: Fetch do ReDoc assets para self-hosted
- `backend/REDOC_SELFHOST.md`: Documentação self-hosted do OpenAPI
- `scripts/datasets/*`: Geradores de dados para ingest (JSON creators)
- `scripts/e2e_run_full.ps1`: Runner E2E completo (Docker + API + Portal)
- `scripts/s7_validate_ingest.ps1`: Validador de ingest S7

### Documentação Técnica
- `docs/BASELINE_V1.md`: Baseline do eControle v1
- `docs/INTEGRATION_CONTRACTS.md`: Contratos de integração (CertHub/Scribere)
- `docs/REUSE_FRONTEND_MAP.md`: Mapeamento de componentes reutilizáveis do v1
- `docs/RISKS_AND_DECISIONS_S0.md`: Riscos e decisões arquiteturais
- `docs/S6_INDEX.md`: Índice da Sprint 6
- `docs/S6_RESUMO_EXECUTIVO.md`: Resumo executivo da Sprint 6
- `docs/S6_PATCHES_E_CHECKLIST.md`: Patches e checklist da Sprint 6
- `docs/S6_FRONTEND_REAPROVEITADO.md`: Detalhes de reaproveitamento frontend

## Fluxo de Dados

```
Frontend (React/TS)
    ↓
    → [API Client] → HTTP GET/POST/PUT/DELETE
    ↓
Backend (FastAPI)
    ↓
    → [Rotas v1/endpoints/*]
    ↓
    → [Schemas] (validação Pydantic)
    ↓
    → [Services] (lógica de negócio)
    ↓
    → [Models] (ORM SQLAlchemy)
    ↓
    → [Database] (PostgreSQL)
```

## Configuração

### Variáveis de Ambiente
- `.env` e `.env.example` (não versionados, locais)
- Backend: `app.core.config.Settings` lê do `.env`
- Frontend: Vite injeta em tempo de build

### Dependências
- **Backend**: `requirements.txt` (pip)
- **Frontend**: `package.json` (npm/yarn)
- **Infra**: `docker-compose.yml` (PostgreSQL, Redis, etc.)

## Quick Reference

| Aspecto | Localização |
|---------|-------------|
| **API Principal** | `backend/app/api/v1/` |
| **Modelos** | `backend/app/models/` |
| **Esquemas** | `backend/app/schemas/` |
| **Lógica de Negócio** | `backend/app/services/ingest/` |
| **Testes Backend** | `backend/tests/` |
| **Frontend Principal** | `frontend/src/` |
| **Componentes** | `frontend/src/components/` |
| **Páginas** | `frontend/src/pages/` |
| **Testes Frontend** | `frontend/tests_e2e/` |
| **Testes E2E API** | `tests_e2e/api/` |
| **Migrações DB** | `backend/alembic/versions/` |
| **Documentação Técnica** | `docs/` |
| **Scripts Utilitários** | `scripts/` |
