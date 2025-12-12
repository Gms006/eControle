# Guia de Setup - eControle

Passo a passo para sair do zero até a aplicação executando com o backend FastAPI multi-tenant, ETL idempotente, automação de CND/CAE e frontend React. A visão geral da arquitetura está no [`README.md`](README.md).

---

## 1. Backend e ETL (Python)

Instale dependências e ative o ambiente virtual dentro de `backend/`:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium  # necessário para CND/CAE
```

Crie `backend/.env` com as variáveis mínimas utilizadas por API e ETL:

```ini
DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/econtrole
JWT_SECRET=troque-por-um-segredo
JWT_ALG=HS256
CORS_ORIGINS=["http://localhost:5173"]
CONFIG_PATH=./config.yaml
UTEIS_REQ_ROOT=G:/PMA/Requerimentos Word/Modelos
UTEIS_ALLOWED_EXTS=.pdf,.doc,.docx,.png,.jpg,.jpeg
UTEIS_REQ_MAX_DEPTH=4
```

Variáveis opcionais para automações Playwright de CND/CAE: `CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE`, `API_KEY_2CAPTCHA`.

### 1.1 Banco de dados

Aplique migrations para criar schema, enums e views consumidas pelas rotas:

```bash
cd backend
alembic upgrade head
```

### 1.2 Executar a API v1

```bash
cd backend
uvicorn backend.main:app --reload
```

- Healthcheck em `GET /healthz`.
- Contexto multi-tenant disponível em `GET /__debug/guc`.
- Endpoints protegidos em `/api/v1/*` exigem JWT.

Gere um token de desenvolvimento quando precisar autenticar chamadas:

```bash
cd backend
python scripts/dev/mint_jwt.py --org-id 00000000-0000-0000-0000-000000000001 --sub 1 --role ADMIN
```

### 1.3 ETL (CSV → Postgres)

O ETL reutiliza o `.env` do backend. Exemplos de uso:

```bash
# Ajuda geral
python -m etl

# Validar mapeamento do arquivo vs config.yaml
python -m etl debug-source caminho/dados.csv

# Importação idempotente
python -m etl import caminho/dados.csv --dry-run   # simulação
python -m etl import caminho/dados.csv --apply     # grava no banco
```

Os contratos e aliases ficam em `backend/config.yaml` e `backend/etl/contracts.py`.

### 1.4 Automação de CND/CAE

Após instalar as dependências Python, garanta que o Chromium do Playwright esteja disponível:

```bash
cd backend
python -m playwright install chromium
```

Configure as variáveis opcionais (`CND_DIR_BASE`, `CND_HEADLESS`, `CND_CHROME_PATH`, `CAPTCHA_MODE`, `API_KEY_2CAPTCHA`) para ajustar o modo headless, caminho do navegador e integração com 2Captcha.

---

## 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- O servidor abre em `http://localhost:5173`.
- Para apontar para outro backend, crie `frontend/.env.local` com `VITE_API_URL=https://sua.api/econtrole`.
- O proxy padrão do Vite redireciona `/api` para `http://localhost:8000` durante o desenvolvimento.

---

## 3. Dicas rápidas e troubleshooting

- **Coluna ausente no ETL?** Rode `python -m etl debug-source` e ajuste `backend/config.yaml`.
- **Problemas com Playwright?** Reinstale `python -m playwright install chromium` e confira dependências do Chromium no sistema.
- **JWT inválido?** Verifique `JWT_SECRET`, `JWT_ALG` e o payload usado pelo script `mint_jwt.py`.
- **App não enxerga a organização?** Confirme se o header `Authorization` contém um token com `org_id` válido; o contexto aparece em `/__debug/guc`.

Pronto! O eControle responde na porta 8000 (API) e 5173 (frontend) usando o banco configurado em `DATABASE_URL`.
