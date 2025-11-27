# eControle

Plataforma interna para acompanhar empresas, licenças, taxas, processos administrativos, certificados digitais e materiais de apoio. Os dados operacionais são persistidos diretamente em PostgreSQL, consumidos por uma API FastAPI multi-tenant e por um frontend React. O ETL continua disponível para normalizar arquivos CSV legados quando necessário.

---

## Visão geral

- **Fonte de dados:** PostgreSQL acessado diretamente pela API.
- **ETL:** `python -m etl` grava staging (`stg_*`) a partir de CSV e aplica UPSERT idempotente, preservando `run_id`/`row_hash`.
- **API v1 (multi-tenant):** `backend/main.py` injeta `app.current_org` em cada requisição e expõe rotas `/api/v1/*` com autenticação JWT.
- **Frontend:** React + Vite, configurado via `VITE_API_URL`.

Arquitetura resumida:

```
CSV (opcional) ──▶ backend/etl ──▶ PostgreSQL ──▶ backend/main.py (FastAPI v1)
                                                 │
                                                 ▼
                                            frontend (React 18 + Vite)
```

---

## Componentes

### Backend – API v1 (`backend/main.py`)

- Entrada da aplicação FastAPI com middleware CORS e healthcheck (`/healthz`).
- Contexto multi-tenant aplicado por `db_with_org`, usando `app.current_org` e RBAC (`Role.VIEWER`, `Role.ADMIN`, etc.).
- Rotas em `backend/app/api/v1/` (empresas, licenças, taxas, processos, alertas, grupos/KPIs, municípios, certificados, agendamentos e materiais de apoio).
- Variáveis obrigatórias: `DATABASE_URL` e `JWT_SECRET`. Outras úteis: `JWT_ALG`, `CORS_ORIGINS`, `CONFIG_PATH`, `UTEIS_REQ_ROOT`, `UTEIS_ALLOWED_EXTS`, `UTEIS_REQ_MAX_DEPTH`.
- Script auxiliar: `backend/scripts/dev/mint_jwt.py` gera tokens JWT de desenvolvimento.

### ETL (`backend/etl/`)

- CLI Typer acessível por `python -m etl` (wrapper em `etl/__main__.py`).
- Usa o mesmo `.env` da API v1 (`DATABASE_URL`, `CONFIG_PATH`) e contratos definidos em `contracts.py`.
- Principais comandos:
  - `python -m etl` – ajuda.
  - `python -m etl debug-source caminho/dados.csv` – validação do mapeamento.
  - `python -m etl import caminho/dados.csv --dry-run|--apply` – carga idempotente.

### Automação de CND/CAE (Playwright)

- Módulos `backend/cnds/` e `backend/caes/` utilizam Chromium headless para emissão de documentos.
- Após instalar as dependências Python, execute `python -m playwright install chromium`.
- Configure `CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE` e `API_KEY_2CAPTCHA` conforme o ambiente.

### Frontend (`frontend/`)

- React 18 + Vite + Tailwind + Radix UI.
- `npm run dev` levanta o servidor em `http://localhost:5173`; `VITE_API_URL` pode apontar para outro backend.
- Estrutura por features (`src/features/*`), provedores em `src/providers/` e utilitários em `src/lib/`.

---

## Operação rápida

Use este resumo para validar o ambiente; o passo a passo completo está em [`GUIA_SETUP.md`](GUIA_SETUP.md).

1. **Instalar dependências Python e Playwright**
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   python -m playwright install chromium
   ```
2. **Configurar `.env`** (API v1 e ETL): defina `DATABASE_URL`, `JWT_SECRET`, `CONFIG_PATH` e demais chaves necessárias.
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
5. **Rodar ETL** (exemplo de importação)
   ```bash
   python -m etl import caminho/dados.csv --apply
   ```
6. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Dados e configuração

- Atualize `backend/config.yaml` ao alterar os aliases usados pelo ETL; a CLI `python -m etl debug-source` ajuda a validar o mapeamento.

---

## Testes automatizados

Os testes usam Pytest:

- `tests/test_api_v1.py` cobre autenticação, paginação e filtros da API multi-tenant.
- `tests/test_auth_smoke.py` valida parsing de JWT e hierarquia de roles.
- `tests/test_etl_basic.py` garante idempotência do ETL.
- `tests/test_smoke.py` mantém verificações básicas da API.

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
