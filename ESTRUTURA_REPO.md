# Estrutura do Repositório — eControle v2 (Rebuild)

Padrão inspirado no CertHub: monorepo com backend modular e front isolado.

## Tree (alto nível)
### S5 (companies — ATUAL)
> Primeira entidade org-scoped (companies) com CRUD, filtros e testes de isolamento.

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
│  │  │        ├─ auth.py
│  │  │        ├─ companies.py
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
│  │  │  ├─ org.py
│  │  │  ├─ refresh_token.py
│  │  │  ├─ role.py
│  │  │  └─ user.py
│  │  └─ schemas/
│  │     ├─ __init__.py
│  │     ├─ auth.py
│  │     ├─ company.py
│  │     ├─ org.py
│  │     ├─ token.py
│  │     └─ user.py
│  ├─ alembic/
│  │  ├─ env.py
│  │  ├─ script.py.mako
│  │  └─ versions/
│  │     ├─ 20260218_0001_create_orgs.py
│  │     ├─ 20260218_0002_auth_tables.py
│  │     ├─ 20260218_0003_orgs_slug_updated_at.py
│  │     └─ 20260219_0004_create_companies.py
│  ├─ alembic.ini
│  ├─ tests/
│  │  ├─ conftest.py
│  │  ├─ test_auth_login_me.py
│  │  ├─ test_auth_rbac.py
│  │  ├─ test_auth_refresh_logout.py
│  │  ├─ test_companies_crud.py
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
└─ (scripts/ será adicionado)
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
- Reaproveitar o máximo do eControle v1:
  - features existentes
  - componentes e páginas
- Alterar apenas o necessário:
  - auth (login real)
  - baseURL/proxy
  - abas Certificados/Úteis conforme integrações

### Integrações
- CertHub: espelho read-only + redirecionamento para operações
- Scribere: exports de notas/snippets (read-only) + link para editar/configurar no Scribere
