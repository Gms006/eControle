# eControle

Plataforma interna multi-tenant para acompanhar empresas, licenças, taxas, processos administrativos, certificados digitais, alertas e materiais de apoio. O portal opera diretamente sobre um PostgreSQL versionado via Alembic (schema, enums, views e índices), exposto por uma API FastAPI v1 e consumido pelo frontend React. A leitura direta de planilhas Excel e o ETL permanecem apenas como compatibilidade legada.

> ⚠️ Planilhas operacionais **não são versionadas**. Caso ainda utilize o legado, crie a pasta `data/` localmente e mantenha os arquivos apenas em ambientes controlados.

---

## Visão geral

- **Base de dados:** schema multi-tenant com `org_id`, enums (`user_role_enum`, `situacao_processo_enum`, etc.), triggers de `updated_at`, views consolidadas (`v_empresas`, `v_licencas_status`, `v_taxas_status`, `v_processos_resumo`, `v_alertas_vencendo_30d`, `v_grupos_kpis`, `v_contatos_uteis`, `v_modelos_uteis`, entre outras) e índices funcionais para busca normalizada (`immutable_unaccent`). Tudo é criado por Alembic em `backend/migrations`.
- **API v1 (multi-tenant):** `backend/main.py` injeta `app.current_org` por requisição e aplica RBAC (`Role.VIEWER`, `Role.ADMIN`, etc.) via JWT. Endpoints estáveis em `/api/v1/*` cobrem empresas, licenças, taxas, processos, KPIs, alertas, municípios, úteis e um stub de agendamentos.
- **Frontend:** React + Vite, consumindo `/api/v1/*` via `VITE_API_URL` ou proxy do Vite; o layout atual já espera as views e contratos da API v1.
- **Legado opcional:**
  - **ETL** (`python -m etl`): importa planilhas `.xlsm` para staging (`stg_*`) e aplica UPSERT idempotente.
  - **API baseada em planilha** (`backend/api.py`): leitura direta do Excel e automações de CND/CAE.

Arquitetura resumida:

```
PostgreSQL (schema + views Alembic) ──▶ backend/main.py (FastAPI v1) ──▶ frontend (React 18 + Vite)
                     │
                     └── backend/api.py + ETL (compatibilidade com planilha, opcional)
```

---

## Componentes

### Backend – API v1 (`backend/main.py`)

- Entrada da aplicação FastAPI com middleware CORS e healthcheck (`/healthz`).
- Contexto multi-tenant aplicado por `db_with_org`, usando `app.current_org` e RBAC (`Role.VIEWER`, `Role.ADMIN`, etc.).
- Endpoints em `backend/app/api/v1/` baseados em views e tabelas reais do Postgres (`empresas`, `licencas`, `taxas`, `processos`, `alertas`, `grupos/KPIs`, `municipios`, `uteis`, stub de `agendamentos`).
- Variáveis obrigatórias: `DATABASE_URL` e `JWT_SECRET`. Outras úteis: `JWT_ALG`, `CORS_ORIGINS`, `CONFIG_PATH`, `UTEIS_REQ_ROOT`, `UTEIS_ALLOWED_EXTS`, `UTEIS_REQ_MAX_DEPTH`.
- Script auxiliar: `backend/scripts/dev/mint_jwt.py` gera tokens JWT de desenvolvimento.

### Automação de CND/CAE (Playwright)

- Módulos `backend/cnds/` e `backend/caes/` utilizam Chromium headless para emissão de documentos.
- Após instalar as dependências Python, execute `python -m playwright install chromium`.
- Configure `CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE` e `API_KEY_2CAPTCHA` conforme o ambiente.

### Frontend (`frontend/`)

- React 18 + Vite + Tailwind + Radix UI.
- `npm run dev` levanta o servidor em `http://localhost:5173`; `VITE_API_URL` pode apontar para outro backend.
- Estrutura por features (`src/features/*`), provedores em `src/providers/` e utilitários em `src/lib/`.

### Legado/compatibilidade com planilhas (opcional)

- **ETL (`backend/etl/`)**: CLI Typer acessível por `python -m etl`, compartilhando `.env` com a API v1. Útil para importar planilhas `.xlsm` para staging e aplicar UPSERT.
- **API baseada em Excel (`backend/api.py`)**: leitura direta da planilha, rotas `/api/*`, `/api/cnds`, `/api/cae`, `/api/certificados` e serviço estático `/cnds/*` para PDFs emitidos. Configure `EXCEL_PATH`, `CONFIG_PATH`, `CND_DIR_BASE`, `CND_HEADLESS`, `CAPTCHA_MODE`, `API_KEY_2CAPTCHA`.

---

## Operação rápida

Use este resumo para validar o ambiente com a API v1 (PostgreSQL + Alembic) e o frontend; o passo a passo completo está em [`GUIA_SETUP.md`](GUIA_SETUP.md).

1. **Instalar dependências Python e Playwright**
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   python -m playwright install chromium
   ```
2. **Configurar `.env`** (API v1): defina `DATABASE_URL`, `JWT_SECRET`, `CONFIG_PATH` e demais chaves necessárias.
3. **Criar/atualizar schema**
   ```bash
   cd backend
   alembic upgrade head
   ```
4. **Executar API v1**
   ```bash
   cd backend
   uvicorn backend.main:app --reload
   ```
5. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Opcional – ETL para planilhas**
   ```bash
   cd backend
   python -m etl import caminho/planilha.xlsm --apply
   ```

---

## Dados e configuração

- Alembic cria o schema completo (tabelas, enums, views, índices e funções utilitárias). Rode `alembic upgrade head` sempre que atualizar o repositório.
- `backend/config.yaml` centraliza enums e, no legado, aliases de abas; ajuste apenas se ainda usar o ETL/planilhas.
- Planilhas reais não são versionadas; mantenha-as fora do repositório (`data/`) quando precisar do legado.
- Certificados/agendamentos no legado: ajuste `PLANILHA_CERT_PATH` em `backend/services/data_certificados.py`.

---

## Testes automatizados

Os testes usam Pytest:

- `tests/test_api_v1.py` cobre autenticação, paginação e filtros da API multi-tenant.
- `tests/test_auth_smoke.py` valida parsing de JWT e hierarquia de roles.
- `tests/test_etl_basic.py` garante idempotência do ETL.
- `tests/test_smoke.py` mantém verificações básicas da API legada.

Execute com:

```bash
pytest
```

---

## Documentação auxiliar

- [`GUIA_SETUP.md`](GUIA_SETUP.md) – passo a passo detalhado de instalação e execução.
- [`ESTRUTURA_PROJETO.md`](ESTRUTURA_PROJETO.md) – mapa rápido das pastas e responsabilidades.

---

Projeto interno. Consulte o time responsável antes de distribuir.
