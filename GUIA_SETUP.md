# Guia de Setup - eControle

Este passo a passo leva do zero até o projeto rodando com backend FastAPI, integração com Excel macro-enabled (.xlsm), automação de CND/CAE via Playwright e frontend React.

---

## Pré-requisitos

- **Python 3.10+** (recomendado 3.11)
- **Node.js 18+** (o projeto usa Vite)
- **npm** ou **pnpm** (os comandos abaixo usam npm)
- **Git**
- Arquivos Excel `.xlsm`:
  - Planilha operacional (empresas/licenças/taxas/processos/contatos)
  - Planilha de certificados/agendamentos

> Mantenha as planilhas fora do versionamento. Crie `data/` localmente e copie os arquivos para lá.

---

## 1. Backend (FastAPI)

### 1.1 Criar ambiente virtual e instalar dependências

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium  # necessário para automações de CND/CAE
```

O arquivo [`backend/requirements.txt`](backend/requirements.txt) já lista:
- FastAPI, Uvicorn e Pydantic
- openpyxl + portalocker para acessar `.xlsm`
- PyYAML para ler `config.yaml`
- python-dotenv para carregar `.env`
- requests/aiofiles/playwright para automações e rota estática de CND

### 1.2 Configurar variáveis de ambiente

Crie `backend/.env` com as chaves mínimas (ajuste conforme seu ambiente):

```ini
EXCEL_PATH=../data/arquivo.xlsm         # planilha operacional
CONFIG_PATH=./config.yaml               # opcional se usar outro mapeamento
CORS_ORIGINS=http://localhost:5173      # origins permitidos
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
CND_DIR_BASE=certidoes                  # onde os PDFs serão salvos
CND_HEADLESS=true                       # false para acompanhar a automação
CAPTCHA_MODE=manual                     # image_2captcha para resolver automaticamente
API_KEY_2CAPTCHA=                       # obrigatório se usar 2Captcha
```

Em produção, considere chaves adicionais:
- `CND_CHROME_PATH` para apontar para um executável Chromium customizado.
- `PLANILHA_CERT_PATH` (ver abaixo) para centralizar o caminho da planilha de certificados.

### 1.3 Configurar `config.yaml` e planilhas

- Atualize `backend/config.yaml` com os nomes de abas (`sheet_names`), tabelas (`table_names`) e aliases (`column_aliases`).
- Use o endpoint `/api/diagnostico` para validar se todas as colunas obrigatórias foram reconhecidas.
- Se a planilha mudar de layout, ajuste o YAML e recarregue o backend (`/api/refresh`).

### 1.4 Planilha de certificados

O arquivo [`backend/services/data_certificados.py`](backend/services/data_certificados.py) contém a constante `PLANILHA_CERT_PATH`. Altere-a para o caminho correto da planilha `.xlsm` que armazena certificados/agendamentos. Utilize caminhos absolutos em produção.

### 1.5 Executar o backend

```bash
uvicorn api:app --reload --host $API_HOST --port $API_PORT
```

Testes rápidos:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/empresas?query=&municipio=&so_alertas=false"
```

Para recarregar a planilha sem reiniciar o servidor use `POST /api/refresh`.

---

## 2. Frontend (React + Vite)

### 2.1 Instalar dependências

```bash
cd frontend
npm install
```

Principais dependências:
- React 18 + React DOM
- Tailwind CSS + postcss/autoprefixer
- shadcn/ui (componentes Radix `.jsx` adaptados)
- Recharts, lucide-react, clsx, tailwind-merge

### 2.2 Variáveis de ambiente

Durante o desenvolvimento o proxy do Vite (configurado em `vite.config.js`) redireciona `/api` para `http://localhost:8000`. Para apontar para outra origem (ex.: homologação), crie `frontend/.env.local` com:

```
VITE_API_URL=https://sua.api/econtrole
```

### 2.3 Rodar o frontend

```bash
npm run dev
```

A aplicação abrirá em `http://localhost:5173`. A aba **Painel** usa os KPIs do backend; as demais abas (Empresas, Licenças, Taxas, Processos, Úteis, Certificados) consomem os demais endpoints.

---

## 3. Automação de CND/CAE (Playwright)

- Execute `python -m playwright install chromium` sempre que atualizar o Playwright.
- Ajuste `CND_HEADLESS=false` para depurar captchas manualmente.
- Para habilitar resolução automática de captcha configure:
  ```ini
  CAPTCHA_MODE=image_2captcha
  API_KEY_2CAPTCHA=sua-chave
  ```
- Os PDFs ficam em `CND_DIR_BASE` e são servidos em `/cnds/<arquivo>.pdf`.
- A emissão de CAE (`POST /api/cae/emitir`) espera município `Anápolis`, CNPJ com 14 dígitos e inscrição municipal normalizada.

---

## 4. Integração com VS Code (opcional)

`.vscode/launch.json` sugerido para debug:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: Uvicorn",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["api:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
      "envFile": "${workspaceFolder}/backend/.env",
      "cwd": "${workspaceFolder}/backend"
    },
    {
      "name": "Frontend: Vite",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"]
    }
  ]
}
```

`.vscode/settings.json` mínimo:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python",
  "python.terminal.activateEnvironment": true,
  "editor.formatOnSave": true
}
```

---

## 5. Dúvidas frequentes

- **Planilha não carrega?** Confira `EXCEL_PATH`, permissões de leitura e se outra pessoa não está com a planilha aberta (o lock usa `portalocker`).
- **Coluna não aparece?** Rode `/api/diagnostico` e veja se o alias está no `config.yaml`.
- **Playwright reclama de dependências?** Execute novamente `python -m playwright install chromium`. Em ambientes Linux, confirme se bibliotecas do Chromium estão instaladas.
- **Frontend não acha a API?** Verifique `VITE_API_URL` ou o proxy no `vite.config.js`.

Pronto! O eControle deve estar acessível em `http://localhost:5173` utilizando o backend em `http://localhost:8000`.
