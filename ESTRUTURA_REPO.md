# Estrutura do Repositório — eControle v2 (Rebuild)

Padrão inspirado no CertHub: monorepo com backend modular e front isolado.

## Tree (alto nível)
### S7 (ingest JSON — ATUAL)
> Domínio core + ingest JSON com tracking (`ingest_runs`) e endpoints separados por dataset (`licences/taxes/processes`).

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
│  │  │  ├─ config.py
│  │  │  ├─ logging.py
│  │  │  ├─ org_context.py
│  │  │  ├─ security.py
│  │  │  └─ audit.py
│  │  ├─ db/
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
│  │  └─ services/
│  │     └─ ingest/
│  │        ├─ __init__.py
│  │        ├─ companies.py
│  │        ├─ company_profiles.py
│  │        ├─ licences.py
│  │        ├─ processes.py
│  │        ├─ run.py
│  │        ├─ taxes.py
│  │        └─ utils.py
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
│  ├─ alembic.ini
│  ├─ tests/
│  │  ├─ conftest.py
│  │  ├─ test_auth_login_me.py
│  │  ├─ test_auth_rbac.py
│  │  ├─ test_auth_refresh_logout.py
│  │  ├─ test_companies_crud.py
│  │  ├─ test_ingest_s7.py
│  │  ├─ test_ingest_s7_full.py
│  │  ├─ test_org_context.py
│  │  └─ test_health.py
│  └─ main.py
├─ infra/
│  └─ docker-compose.yml
├─ docs/
│  ├─ BASELINE_V1.md
│  ├─ INTEGRATION_CONTRACTS.md
│  ├─ REUSE_FRONTEND_MAP.md
│  └─ RISKS_AND_DECISIONS_S0.md
├─ .env
├─ .env.example
├─ .git/
├─ .gitignore
├─ .vscode/
├─ ESTRUTURA_REPO.md
├─ PLANO_DESENVOLVIMENTO.md
├─ README.md
├─ requirements.txt
├─ patch.diff
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
│  ├─ e2e_run.ps1
│  ├─ e2e_run_full.ps1
│  └─ s7_validate_ingest.ps1
└─ patch.diff
```

### Alvo (S2+ / padrão CertHub)
```
eControle/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ api.py
│  │  │     └─ endpoints/
│  │  │        ├─ auth.py
│  │  │        ├─ empresas.py
│  │  │        ├─ licencas.py
│  │  │        ├─ taxas.py
│  │  │        ├─ processos.py
│  │  │        ├─ certificados_mirror.py
│  │  │        ├─ utiles_exports.py
│  │  │        ├─ integracoes_certhub.py
│  │  │        └─ integracoes_scribere.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ security.py
│  │  │  ├─ audit.py
│  │  │  └─ logging.py
│  │  ├─ db/
│  │  │  ├─ session.py
│  │  │  └─ base.py
│  │  ├─ models/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  ├─ workers/
│  │  └─ watchers/
│  ├─ alembic/
│  ├─ alembic.ini
│  ├─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  ├─ vite.config.(js|ts)
│  └─ package.json
├─ infra/
│  └─ docker-compose.yml
├─ docs/
│  ├─ BASELINE_V1.md
│  ├─ REUSE_FRONTEND_MAP.md
│  ├─ INTEGRATION_CONTRACTS.md
│  ├─ RISKS_AND_DECISIONS_S0.md
│  └─ S0_CHECKLIST.md
├─ scripts/
├─ .gitignore
└─ README.md
```

## Convenções

### Backend
- Rotas sempre em `/api/v1/*`
- `core/` para config, segurança (JWT, cookies), auditoria e logs
- `services/` para clients de integração (CertHub/Scribere) e regras de domínio
- `workers/` e `watchers/` para jobs RQ e rotinas de sincronização/ingest

### Frontend
- `frontend/src/pages` é a fonte de verdade para telas/abas.
- Reaproveitar o máximo do eControle v1:
  - componentes e páginas
- Alterar apenas o necessário:
  - auth (login real)
  - baseURL/proxy
  - abas Certificados/Úteis conforme integrações
- AppShell em `frontend/src/pages/MainApp.tsx` renderiza:
  - `PainelScreen.jsx`
  - `EmpresasScreen.jsx`
  - `LicencasScreen.jsx`
  - `TaxasScreen.jsx`
  - `ProcessosScreen.jsx`

### Integrações
- CertHub: espelho read-only + redirecionamento para operações
- Scribere: exports de notas/snippets (read-only) + link para editar/configurar no Scribere

---

## Novos arquivos (E2E full)

```text
scripts/
├─ e2e_run_full.ps1              # runner E2E completo (infra + API + portal)
└─ .e2e-logs/                    # logs gerados em runtime (criado pelo script)

tests_e2e/
└─ api/
   └─ test_api_ingest_e2e.py     # pytest E2E HTTP real (login + ingest S7)

frontend/
├─ playwright.config.ts          # config do Playwright
└─ tests_e2e/
   └─ portal/
      └─ login_empresas.smoke.spec.ts
```

### Seletores E2E adicionados no portal

* `frontend/src/pages/auth/Login.tsx`
  * `data-testid="login-email"`
  * `data-testid="login-password"`
  * `data-testid="login-submit"`
* `frontend/src/components/HeaderMenuPro.jsx`
  * `data-testid="nav-tab-<aba>"`
* `frontend/src/pages/EmpresasScreen.jsx`
  * `companies-summary`, `companies-grid`, `company-card`
