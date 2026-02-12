# Estrutura do Repositório — eControle v2 (Rebuild)

Padrão inspirado no CertHub: monorepo com backend modular e front isolado.

## Tree (alto nível)
### S1 (mínimo real — ATUAL)
> Estrutura mínima para subir infra (Postgres/Redis) + API com healthchecks.

```
eControle/
├─ backend/
│  ├─ main.py
│  ├─ __pycache__/
│  └─ (estrutura app/ será expandida)
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
