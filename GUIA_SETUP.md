# Guia de Setup - eControle

Passo a passo para sair do zero até a aplicação executando com o backend FastAPI multi-tenant, ETL idempotente, automação de CND/CAE e frontend React. Use-o como referência prática; a visão geral está no [`README.md`](README.md).

---

## 1. Preparar ambiente Python (API v1 + ETL)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium  # requerido para CND/CAE
```

### 1.1 Variáveis de ambiente (`backend/.env`)

A API v1 e o ETL compartilham o mesmo `.env`. Defina ao menos:

```ini
DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/econtrole
JWT_SECRET=troque-por-um-segredo
JWT_ALG=HS256
CONFIG_PATH=./config.yaml
CORS_ORIGINS=["http://localhost:5173"]
UTEIS_REQ_ROOT=G:/PMA/Requerimentos Word/Modelos
UTEIS_ALLOWED_EXTS=.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg
UTEIS_REQ_MAX_DEPTH=4
```

Outras chaves opcionais:

- `CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE`, `API_KEY_2CAPTCHA` – automações Playwright de CND/CAE.
- `PLANILHA_CERT_PATH` em produção, para apontar a planilha real de certificados/agendamentos (ver `backend/services/data_certificados.py`).

### 1.2 Banco de dados

Crie/atualize o schema com Alembic:

```bash
cd backend
alembic upgrade head
```

As migrations geram as tabelas, enums e views utilizadas pelas rotas da API v1.

### 1.3 Executar a API v1

```bash
cd backend
uvicorn backend.main:app --reload
```

- Healthcheck: `GET /healthz`.
- Debug multi-tenant: `GET /__debug/guc`.
- Rotas principais em `/api/v1/*` exigem JWT (`Authorization: Bearer ...`).

Para gerar um token de desenvolvimento:

```bash
cd backend
python scripts/dev/mint_jwt.py --org-id 00000000-0000-0000-0000-000000000001 --sub 1 --role ADMIN
```

---

## 2. ETL (Excel → Postgres)

Utilize o mesmo `.env` do backend. Exemplos:

```bash
# Ajuda geral
python -m etl

# Validar mapeamento da planilha vs config.yaml
python -m etl debug-source caminho/planilha.xlsm

# Importação idempotente
python -m etl import caminho/planilha.xlsm --dry-run   # simulação
python -m etl import caminho/planilha.xlsm --apply     # grava no banco
```

O contrato do ETL fica em `backend/etl/contracts.py` e usa as configurações de `config.yaml` para mapear abas, tabelas e aliases.

---

## 3. Backend legado (opcional)

Para leitura direta da planilha (sem banco), configure outro `.env` em `backend/` com os valores mínimos:

```ini
EXCEL_PATH=../data/operacional.xlsm
CONFIG_PATH=./config.yaml
CORS_ORIGINS=http://localhost:5173
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

As rotas `/api/*`, `/api/cnds`, `/api/cae` e `/api/certificados` ficarão disponíveis; os PDFs gerados ficam em `CND_DIR_BASE`.

---

## 4. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- O servidor abre em `http://localhost:5173`.
- Para apontar para outro backend, crie `frontend/.env.local` com `VITE_API_URL=https://sua.api/econtrole`.
- O proxy padrão do Vite redireciona `/api` para `http://localhost:8000` durante o desenvolvimento.

---

## 5. Dicas rápidas e troubleshooting

- **Planilha não carrega?** Verifique `EXCEL_PATH`, permissões e se o arquivo não está aberto por outra pessoa (lock via `portalocker`).
- **Coluna ausente?** Rode `python -m etl debug-source` ou `/api/diagnostico` (legado) e ajuste `backend/config.yaml`.
- **Problemas com Playwright?** Reinstale `python -m playwright install chromium` e valide dependências do Chromium no sistema.
- **JWT inválido?** Confira `JWT_SECRET`, `JWT_ALG` e o payload usado pelo script `mint_jwt.py`.

Pronto! O eControle deve responder na porta 8000 (API) e 5173 (frontend) usando o banco configurado em `DATABASE_URL`.
