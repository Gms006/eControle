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
UTEIS_ALLOWED_EXTS=.pdf,.doc,.docx,.png,.jpg,.jpeg
UTEIS_REQ_MAX_DEPTH=4
```

Outras chaves opcionais:

- `CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE`, `API_KEY_2CAPTCHA` – automações Playwright de CND/CAE.

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

## 2. ETL (CSV → Postgres)

Utilize o mesmo `.env` do backend. Exemplos:

```bash
# Ajuda geral
python -m etl

# Validar mapeamento do arquivo vs config.yaml
python -m etl debug-source caminho/dados.csv

# Importação idempotente
python -m etl import caminho/dados.csv --dry-run   # simulação
python -m etl import caminho/dados.csv --apply     # grava no banco
```

O contrato do ETL fica em `backend/etl/contracts.py` e usa as configurações de `config.yaml` para mapear aliases e enums.

---
## 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- O servidor abre em `http://localhost:5173`.
- Para apontar para outro backend, crie `frontend/.env.local` com `VITE_API_URL=https://sua.api/econtrole`.
- O proxy padrão do Vite redireciona `/api` para `http://localhost:8000` durante o desenvolvimento.


## 4. Dicas rápidas e troubleshooting

- **Coluna ausente?** Rode `python -m etl debug-source` e ajuste `backend/config.yaml`.
- **Problemas com Playwright?** Reinstale `python -m playwright install chromium` e valide dependências do Chromium no sistema.
- **JWT inválido?** Confira `JWT_SECRET`, `JWT_ALG` e o payload usado pelo script `mint_jwt.py`.

Pronto! O eControle deve responder na porta 8000 (API) e 5173 (frontend) usando o banco configurado em `DATABASE_URL`.
