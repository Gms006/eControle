# eControle

Plataforma interna para acompanhar empresas, licenças, taxas, processos administrativos, certificados digitais e materiais de apoio. Os dados operacionais nascem em planilhas Excel macro-enabled (`.xlsm`), são normalizados por um ETL idempotente e ficam disponíveis em um banco PostgreSQL consumido por uma API FastAPI multi-tenant e pelo frontend React.

> ⚠️ As planilhas reais **não são versionadas**. Crie a pasta `data/` localmente e armazene os arquivos apenas em ambientes controlados.

---

## Arquitetura em alto nível

```
Excel (.xlsm/.csv) ──▶ backend/etl ──▶ PostgreSQL ──▶ backend/main.py (FastAPI v1)
          │                                       │
          └──────────── backend/api.py ───────────┘  (API legada baseada em planilha)
                                                    ▼
                                               frontend (React 18 + Vite)
```

- **Planilhas** – abas e ListObjects são mapeados via `backend/config.yaml`.
- **ETL (`backend/etl/`)** – CLI `python -m etl` carrega planilhas para staging (`stg_*`) e aplica UPSERT idempotente.
- **API multi-tenant (`backend/main.py`)** – lê do PostgreSQL, injeta `app.current_org` por request e expõe endpoints `/api/v1/*`.
- **API legada (`backend/api.py`)** – ainda serve leitura direta do Excel, automações CND/CAE e planilha de certificados.
- **Frontend (`frontend/`)** – React + Vite, consome a API configurada em `VITE_API_URL`.

Documentos auxiliares:
- [`GUIA_SETUP.md`](GUIA_SETUP.md) – passo a passo detalhado de instalação.
- [`ESTRUTURA_PROJETO.md`](ESTRUTURA_PROJETO.md) – blueprint resumido das pastas.

---

## Estrutura do repositório

```
.
├── backend/
│   ├── main.py                  # Entrada da API multi-tenant (uvicorn backend.main:app)
│   ├── api.py                   # API legada baseada em planilha + automações
│   ├── app/                     # Código da API v1 (rotas, deps, schemas, serviços)
│   ├── db/                      # Modelos SQLAlchemy e sessão
│   ├── etl/                     # Extract/Transform/Load e CLI Typer
│   ├── migrations/              # Alembic (schema + staging)
│   ├── services/                # Integração com planilha de certificados
│   ├── cnds/, caes/             # Automação Playwright para CND/CAE
│   ├── scripts/dev/mint_jwt.py  # Utilitário para gerar JWT de desenvolvimento
│   ├── config.yaml              # Mapeamentos de abas/tabelas/aliases/enums
│   └── requirements.txt         # Dependências Python do backend/ETL
├── etl/__main__.py              # Wrapper para `python -m etl`
├── frontend/                    # Aplicação React 18 + Vite + Tailwind
├── tests/                       # Pytest (API v1, ETL e smoke tests)
├── README.md
├── GUIA_SETUP.md
└── ESTRUTURA_PROJETO.md
```

---

## Pré-requisitos

- **Python 3.10+** (recomendado 3.11) – backend, ETL e automações.
- **Node.js 18+** – frontend com Vite.
- **PostgreSQL 14+** – armazenamento do schema `s1`/`s2` (tabelas e views).
- **Playwright Chromium** – obrigatório para emissões de CND/CAE (`python -m playwright install chromium`).
- Planilhas `.xlsm` originais (operacional + certificados/agendamentos).

---

## Backend – API multi-tenant (`backend/main.py`)

### Instalação e dependências

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium  # necessário para automações CND/CAE
```

`requirements.txt` inclui FastAPI/Uvicorn, SQLAlchemy, Alembic, `email-validator` (requerido por `EmailStr`), openpyxl/portalocker, Playwright e utilitários como Typer e python-dotenv.【F:backend/requirements.txt†L1-L25】

### Variáveis de ambiente (`backend/.env`)

A API lê as configurações por meio de `app.core.config.Settings`. Crie um `.env` contendo, no mínimo:

```ini
DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/econtrole
JWT_SECRET=troque-por-um-segredo
JWT_ALG=HS256
CORS_ORIGINS=["http://localhost:5173"]
CONFIG_PATH=./config.yaml
UTEIS_REQ_ROOT=G:/PMA/Requerimentos Word/Modelos   # diretório dos materiais de apoio
UTEIS_ALLOWED_EXTS=.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg
UTEIS_REQ_MAX_DEPTH=4
```

- `DATABASE_URL` é obrigatório e também usado pelo Alembic/ETL.【F:backend/app/core/config.py†L14-L107】
- `CONFIG_PATH` aponta para o YAML de aliases/enums carregado por `Settings` e pelos modelos SQL.【F:backend/app/core/config.py†L18-L106】【F:backend/db/models_sql.py†L23-L44】
- Os parâmetros `UTEIS_*` alimentam o serviço de navegação de arquivos em `/api/v1/uteis` (listagem e download).【F:backend/app/services/file_browse.py†L1-L120】【F:backend/app/api/v1/endpoints/uteis.py†L1-L174】

Outras variáveis suportadas incluem `CND_DIR_BASE`, `CND_HEADLESS`, `CAPTCHA_MODE` e `API_KEY_2CAPTCHA` para automações Playwright (ver seção específica abaixo). O carregamento do `.env` é feito automaticamente por `python-dotenv` nas migrations, na CLI e em scripts auxiliares.【F:backend/migrations/env.py†L18-L34】【F:backend/etl/cli.py†L16-L19】【F:backend/scripts/dev/mint_jwt.py†L1-L37】

### Criar/atualizar o schema

```bash
cd backend
alembic upgrade head
```

As migrations criam o schema operacional, views (`v_empresas`, `v_licencas_status`, `v_taxas_status`, `v_processos_resumo`, `v_alertas_vencendo_30d`, `v_grupos_kpis`) e índices multi-tenant utilizados pelas rotas da API.【F:tests/test_api_v1.py†L33-L119】【F:backend/app/api/v1/endpoints/empresas.py†L1-L84】

### Executar a API v1

```bash
cd backend
uvicorn backend.main:app --reload
```

- Healthcheck: `GET /healthz`.
- Debug do contexto multi-tenant: `GET /__debug/guc` (retorna o valor atual de `app.current_org`).【F:backend/main.py†L20-L42】
- Endpoints principais (`/api/v1`): empresas, licenças, taxas, processos, alertas, grupos (KPIs) e materiais de apoio/contatos/modelos.【F:backend/app/api/v1/api.py†L1-L21】【F:backend/app/api/v1/endpoints】

Todos os endpoints autenticados utilizam JWT (`Authorization: Bearer <token>`) e aplicam RBAC com `Role.VIEWER` ou `Role.ADMIN`. A dependência `db_with_org` garante isolamento por organização via `SET app.current_org = :org_id`.【F:backend/app/deps/auth.py†L1-L104】

### Gerar um JWT de desenvolvimento

```bash
cd backend
python scripts/dev/mint_jwt.py --org-id 00000000-0000-0000-0000-000000000001 --sub 1 --role ADMIN
```

O script exibe o fingerprint do segredo carregado e o token já assinado, pronto para testes manuais ou para o botão **Authorize** do Swagger.【F:backend/scripts/dev/mint_jwt.py†L1-L66】

---

## Stages da migração

> A migração do legado baseado em planilha para a API multi-tenant está sendo conduzida em etapas. Utilize os checkpoints abaixo para acompanhar o progresso do ambiente.

### S1 – Schema versionado (PostgreSQL)

1. **Configuração** – garanta que `DATABASE_URL` e `CONFIG_PATH` estejam definidos no `backend/.env` (ver seção [Variáveis de ambiente](#variáveis-de-ambiente-backendenv)).
2. **Criar/atualizar o schema** – rode `alembic upgrade head` dentro de `backend/` para criar tabelas, enums, views e índices necessários.【F:backend/migrations/env.py†L18-L34】
3. **Smoke tests** – execute `psql "$DATABASE_URL" -c "SELECT * FROM v_empresas LIMIT 5;"` e demais views para validar seeds e permissões.

Critérios de pronto: migrations sem erros, views populadas (via seeds) e enums coerentes com o `config.yaml`.

### S2 – ETL idempotente (Excel → Postgres)

1. **Dependências** – use o mesmo ambiente virtual do backend (`pip install -r requirements.txt`).
2. **Staging** – mantenha o schema atualizado (S1) para assegurar a existência das tabelas `stg_*` e constraints de suporte.【F:backend/etl/cli.py†L1-L120】
3. **Execução** – acione `python -m etl import caminho/planilha.xlsm --apply` (ou `--dry-run`) para carregar planilhas conforme o contrato definido em `backend/etl/contracts.py`.
4. **Validação** – analise a saída JSONL (`action: insert/update/skip`) e verifique a consistência via consultas nas views (`v_licencas_status`, `v_taxas_status`, etc.).

Critérios de pronto: execução idempotente (execuções repetidas retornando `skip`), diffs consistentes e staging preservando `run_id`/`row_hash`.

### S3 – API FastAPI multi-tenant

1. **Aplicação** – suba `uvicorn backend.main:app --reload` com o `.env` configurado (JWT, CORS, etc.).【F:backend/main.py†L20-L42】
2. **Autenticação** – gere tokens com `scripts/dev/mint_jwt.py` e teste os endpoints `/api/v1/*` autenticados.
3. **Multi-tenant** – confirme, via `GET /__debug/guc`, que o `org_id` está sendo injetado corretamente e que as views filtram os registros conforme a organização.【F:backend/app/deps/auth.py†L1-L104】

Critérios de pronto: saúde do healthcheck (`/healthz`), endpoints críticos respondendo com paginação esperada e RBAC (`Role.ADMIN`/`Role.VIEWER`) validado nos fluxos principais.

---

## Backend legado baseado em planilha (`backend/api.py`)

A versão antiga do backend continua disponível para cenários em que a leitura seja feita diretamente da planilha Excel (sem banco). Ela mantém o cache em memória, as rotas `/api/*`, `/api/cnds`, `/api/cae`, `/api/certificados` e o serviço estático `/cnds` para PDFs.

Variáveis mínimas no `.env` (além das utilizadas pela API v1):

```ini
EXCEL_PATH=../data/operacional.xlsm
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
CND_DIR_BASE=certidoes
CND_HEADLESS=true
CAPTCHA_MODE=manual
API_KEY_2CAPTCHA=
```

Execute com:

```bash
cd backend
uvicorn backend.api:app --reload --host $API_HOST --port $API_PORT
```

O módulo usa `ExcelRepo` para mapear abas/tabelas conforme `config.yaml`, expõe diagnósticos (`/api/diagnostico`), agenda recargas (`/api/refresh`) e integra as automações Playwright herdadas.【F:backend/api.py†L1-L120】【F:backend/repo_excel.py†L1-L160】 O arquivo `backend/services/data_certificados.py` lê a planilha dedicada de certificados/agendamentos; ajuste a constante `PLANILHA_CERT_PATH` ao seu ambiente.【F:backend/services/data_certificados.py†L1-L60】

---

## ETL (Excel → Postgres)

A CLI em `backend/etl/cli.py` implementa o fluxo Extract/Transform/Load usado nas fases S2/S3.

```bash
# Ajuda
python -m etl

# Diagnóstico do arquivo x contrato
python -m etl debug-source caminho/planilha.xlsm

# Importação idempotente
python -m etl import caminho/planilha.xlsm --dry-run   # simulação
python -m etl import caminho/planilha.xlsm --apply     # grava no banco
```

- O contrato (`backend/etl/contracts.py`) mapeia `sheet_names`, `table_names` e aliases com base no `config.yaml`.
- `extract_xlsm.py` lê abas/ListObjects respeitando o mapeamento; `transform_normalize.py` padroniza cabeçalhos, datas, CNPJ e enums; `load_upsert.py` grava em staging com `run_id`/`row_hash` e aplica UPSERT idempotente usando SQLAlchemy core.【F:backend/etl/cli.py†L1-L120】
- As mesmas variáveis de ambiente da API (`DATABASE_URL`, `CONFIG_PATH`) são usadas durante a execução (carregadas via `python-dotenv`).【F:backend/etl/cli.py†L16-L72】

Testes direcionados ao ETL estão em `tests/test_etl_basic.py` e cobrem duplicidade, enums inválidos, datas inválidas e updates parciais.

---

## Automação de CND/CAE (Playwright)

Os módulos em `backend/cnds/` e `backend/caes/` utilizam Playwright Chromium para emitir CNDs municipais e CAE de Anápolis.

Configurações úteis no `.env`:

```ini
CND_DIR_BASE=certidoes
CND_HEADLESS=true               # defina false para depurar
CND_CHROME_PATH=                # opcional: caminho para executável Chromium customizado
CAPTCHA_MODE=manual             # ou image_2captcha
API_KEY_2CAPTCHA=               # obrigatório se usar 2Captcha
```

Após instalar as dependências Python, execute `python -m playwright install chromium`. Os PDFs gerados ficam em `CND_DIR_BASE` e são servidos pela API legada em `/cnds/<arquivo>.pdf`. As rotas disponíveis estão em `backend/cnds/municipal/routes.py` e `backend/caes/routes.py`.

---

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- O servidor de desenvolvimento sobe em `http://localhost:5173` e proxia `/api` para `http://localhost:8000` durante o desenvolvimento.
- Defina `VITE_API_URL` em `frontend/.env.local` se precisar apontar para outro backend em produção/homologação.
- A estrutura de componentes está organizada por feature (`src/features/*`), com provedores em `src/providers/` e utilitários em `src/lib/`.

Dependências principais: React 18, Vite 5, Tailwind 3, Radix UI (shadcn), lucide-react e Recharts.【F:frontend/package.json†L1-L33】

---

## Testes automatizados

A suíte de testes utiliza Pytest:

```bash
pytest
```

- `tests/test_api_v1.py` valida autenticação, paginação e filtros da API multi-tenant usando sessões fake in-memory.
- `tests/test_auth_smoke.py` cobre parsing de JWT e hierarquia de roles.
- `tests/test_etl_basic.py` garante a idempotência do ETL.
- `tests/test_smoke.py` mantém verificações básicas da API legada.

---

## Dados e configuração

- Atualize `backend/config.yaml` sempre que as planilhas mudarem de layout (novos cabeçalhos, tabelas ou enums). As rotas `/api/diagnostico` (legado) e `python -m etl debug-source` ajudam a validar o mapeamento.【F:backend/config.yaml†L1-L160】
- Ajuste `PLANILHA_CERT_PATH` em `backend/services/data_certificados.py` para apontar para a planilha real de certificados/agendamentos.【F:backend/services/data_certificados.py†L1-L60】
- Os arquivos Excel permanecem fora do repositório; use `data/` apenas localmente.

---

## Licença

Projeto interno. Consulte o time responsável antes de distribuir.
