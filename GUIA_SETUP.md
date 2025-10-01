# Guia Completo de Setup - eControle

Este guia leva do zero ao projeto rodando, com **backend FastAPI** lendo/escrevendo um **Excel .xlsm** (preservando macros) e **frontend React (TypeScript)** usando a interface do protótipo.

---

## Pré‑requisitos

* **Python 3.10** (seu ambiente atual — compatível)
* **Node 20+** e **npm**
* **Git**
* Arquivo **Excel .xlsm** em `data/arquivo.xlsm` *(não versionar)*

---

## 1) Backend (Python/FastAPI)

### Estrutura esperada

```
backend/
├─ api.py
├─ repo_excel.py
├─ models.py
├─ services.py
├─ config.yaml
├─ requirements.txt
└─ .env
```

### Ambiente e dependências

> Você já tem uma **.venv** e usa **VS Code**. Então **não crie outra venv** — apenas selecione sua venv no VS Code.

**Usando sua .venv existente (VS Code):**

1. Abra o projeto no VS Code.
2. `Ctrl+Shift+P` → **Python: Select Interpreter** → escolha a sua **.venv**.
3. No terminal integrado, confirme `python --version` (esperado: `3.10.x`).
4. Instale as dependências:

```bash
cd backend
pip install -r requirements.txt
```

**(Opcional) Criar venv nova**

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate
pip install -r requirements.txt
```

**requirements.txt (sugestão mínima):**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.8.2
pydantic-settings==2.4.0
openpyxl==3.1.5
pandas==2.2.3
portalocker==2.10.1
python-multipart==0.0.9
PyYAML==6.0.2
```

### Configuração do ambiente

Crie o arquivo **.env** (ou copie de `.env.example`):

```dotenv
EXCEL_PATH=../data/arquivo.xlsm
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
```

Crie o **config.yaml** com nomes de abas e aliases tolerantes a variações nos cabeçalhos:

```yaml
sheets:
  empresas: "EMPRESAS"
  licencas: "LICENCAS"
  taxas: "TAXAS"
  processos: "PROCESSOS"   # ou "Diversos", conforme sua planilha

aliases:
  empresas:
    id: ["ID", "EMPRESA_ID", "COD"]
    empresa: ["EMPRESA", "RAZAO SOCIAL", "RAZAO_SOCIAL"]
    cnpj: ["CNPJ", "CNPJ/CPF"]
    municipio: ["MUNICIPIO", "CIDADE"]
  licencas:
    validade: ["VALIDADE", "VÁLIDO ATÉ", "VAL" ]
    status: ["SITUACAO", "SITUAÇÃO", "STATUS"]
  # etc.
```

### Observações importantes (repo_excel)

* Use `openpyxl.load_workbook(EXCEL_PATH, keep_vba=True, read_only=False, data_only=False)` para **preservar macros**.
* Para escrita segura, aplique **file locking** (ex.: `portalocker.Lock(EXCEL_PATH, mode='r+', timeout=10)`).
* Normalize colunas pelo **aliases** do `config.yaml` (casefold/trim) para tolerar cabeçalhos variados.

### Subir o backend

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### Testes rápidos

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/empresas?query=&municipio=&so_alertas=false"
```

## VS Code (recomendado)

Crie a pasta **.vscode/** com os arquivos abaixo para rodar com um clique.

**.vscode/launch.json** (debug FastAPI e Vite)

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
      "console": "integratedTerminal",
      "envFile": "${workspaceFolder}/backend/.env",
      "cwd": "${workspaceFolder}/backend",
      "justMyCode": true
    },
    {
      "name": "Frontend: Vite",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal"
    }
  ]
}
```

**.vscode/settings.json** (selecione sua venv)

```json
{
  "python.defaultInterpreterPath": "/caminho/para/sua/.venv/bin/python",
  "python.terminal.activateEnvironment": true,
  "editor.formatOnSave": true
}
```

**.vscode/tasks.json** (tarefas auxiliares)

```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "Backend: Install", "type": "shell", "command": "pip install -r requirements.txt", "options": {"cwd": "backend"} },
    { "label": "Frontend: Install", "type": "shell", "command": "npm install", "options": {"cwd": "frontend"} }
  ]
}
```

---

## 2) Frontend (React + Vite + TypeScript)

### Estrutura esperada

```
frontend/
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ index.css
│  ├─ lib/utils.ts
│  └─ components/ui/
│     ├─ badge.tsx
│     ├─ button.tsx
│     ├─ card.tsx
│     ├─ input.tsx
│     ├─ label.tsx
│     ├─ scroll-area.tsx
│     ├─ select.tsx
│     ├─ separator.tsx
│     ├─ switch.tsx
│     ├─ table.tsx
│     └─ tabs.tsx
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.ts
└─ postcss.config.js
```

### Instalação

```bash
cd frontend
npm install

# TypeScript
npm i -D typescript @types/react @types/react-dom

# shadcn/ui (primeira vez)
npx shadcn-ui@latest init
npx shadcn-ui@latest add card button input select tabs table switch scroll-area separator badge label

# Libs adicionais
npm install lucide-react recharts clsx tailwind-merge

# Tailwind
npx tailwindcss init -p
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
})
```

### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

### `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

### `src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### `src/lib/utils.ts` (helper `cn`)

```ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs))
}
```

### Rodando o frontend

```bash
npm run dev
# http://localhost:5173
```

---

## 3) Subir tudo

* **Terminal 1**: `cd backend && uvicorn api:app --reload --port 8000`
* **Terminal 2**: `cd frontend && npm run dev`
* A rota `/api` é **proxy** para o backend (definida no `vite.config.ts`).

---

## 4) Troubleshooting

**Excel bloqueado**: feche o arquivo .xlsm e verifique permissões; use `portalocker` no backend.

**CORS/Fetch falhando**: confira `CORS_ORIGINS` no `.env` do backend e o `proxy` no `vite.config.ts`.

**Componentes shadcn/ui não encontrados**: rode novamente os `add` (incluindo `badge` e `label`).

**Erros TS/JSX**: confirme que os arquivos do frontend estão com extensão **.tsx** e `tsconfig.json` existe.

**Status/cores divergentes**: mapeie no backend `status_raw` → `status_ui` (chips) e envie ambos para o frontend.

---

## 5) Próximos Passos

* [ ] Implementar `/api/diagnostico` (mapeamento de colunas/abas + avisos)
* [ ] `portalocker` no `repo_excel.py` com timeout e retries
* [ ] Testes unitários (`tests/`) para repo, services e API
* [ ] Autenticação (JWT) e CORS configuráveis por `.env`
* [ ] Docker Compose (dev/prod)
* [ ] WebSockets para atualizações

---

## 6) Comandos úteis

```bash
# Backend (usando sua .venv já selecionada no VS Code)
cd backend
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```