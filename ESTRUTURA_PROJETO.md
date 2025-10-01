# Estrutura do Projeto eControle (React + FastAPI)

```
econtrole/
│
├── backend/                          # Backend Python (FastAPI)
│   ├── api.py                        # API REST (endpoints)
│   ├── repo_excel.py                 # Repositório Excel (I/O)
│   ├── models.py                     # Dataclasses
│   ├── services.py                   # Validações e lógica
│   ├── config.yaml                   # Configuração
│   ├── requirements.txt              # Dependências Python
│   └── .env                          # Variáveis de ambiente
│
├── frontend/                         # Frontend React (TypeScript)
│   ├── src/
│   │   ├── App.tsx                   # Componente principal
│   │   ├── main.tsx                  # Entry point
│   │   ├── index.css                 # Tailwind CSS
│   │   ├── components/
│   │   │   └── ui/                   # shadcn/ui components
│   │   │       ├── badge.tsx
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── scroll-area.tsx
│   │   │       ├── select.tsx
│   │   │       ├── separator.tsx
│   │   │       ├── switch.tsx
│   │   │       ├── table.tsx
│   │   │       └── tabs.tsx
│   │   └── lib/
│   │       └── utils.ts              # Utilitários (cn helper)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── index.html
│
├── data/                             # Dados (NÃO versionar)
│   └── arquivo.xlsm                  # Excel principal
│
├── tests/                            # Testes
│   ├── test_api.py                   # Testes da API
│   ├── test_repo.py                  # Testes do repositório
│   └── test_services.py              # Testes de serviços
│
├── .gitignore
├── docker-compose.yml                # Docker (opcional)
└── README.md
```

---

## Instalação e Configuração

### 1. Backend (FastAPI)

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Configurar caminho do Excel em .env
echo "EXCEL_PATH=../data/arquivo.xlsm" > .env

# Executar
python api.py
# ou
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

**requirements.txt**:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
openpyxl==3.1.2
pyyaml==6.0.1
python-multipart==0.0.6
portalocker==2.8.2
```

### 2. Frontend (React + Vite + TypeScript)

```bash
cd frontend

# Instalar dependências base
npm install

# TypeScript
npm i -D typescript @types/react @types/react-dom

# shadcn/ui (primeira vez)
npx shadcn-ui@latest init
npx shadcn-ui@latest add card button input select tabs switch scroll-area separator badge label

# Bibliotecas adicionais
npm install lucide-react recharts clsx tailwind-merge

# Tailwind
npx tailwindcss init -p

# Executar desenvolvimento
npm run dev
```

**package.json** (principais dependências):

```json
{
  "name": "econtrole-frontend",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1",
    "recharts": "^2.10.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-separator": "^1.0.3",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.4.0",
    "vite": "^5.0.0"
  }
}
```

### 3. Configuração do Frontend

**vite.config.ts**:

````ts
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
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
````

**tailwind.config.ts**:

````ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
````

**src/main.tsx**:

````tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
````

**src/index.css**:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: system-ui, -apple-system, sans-serif;
  }
}
```

---

## Fluxo de Dados

```
┌─────────────────┐
│  Excel (.xlsm)  │
│  (data/)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  repo_excel.py  │  ← Leitura/escrita com heurística
│  (Backend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  services.py    │  ← Normalização, validações
│  (Backend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  api.py         │  ← Endpoints REST
│  FastAPI        │  ← Cache em memória
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  App.jsx        │  ← Interface React
│  (Frontend)     │  ← Componentes shadcn/ui
└─────────────────┘
```

---

## Comandos Úteis

### Desenvolvimento

```bash
# Terminal 1: Backend
cd backend && python api.py

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Diagnóstico

```bash
# Verificar mapeamento de colunas
cd backend
python repo_excel.py

# Testar API
curl http://localhost:8000/health
curl http://localhost:8000/api/kpis
```

### Build Produção

```bash
# Frontend
cd frontend
npm run build
# Gera dist/ com arquivos estáticos

# Servir com FastAPI
# Adicionar em api.py:
# from fastapi.staticfiles import StaticFiles
# app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

---

## Endpoints da API

| Método | Endpoint             | Descrição                    |
| ------ | -------------------- | ---------------------------- |
| GET    | `/`                  | Info da API                  |
| GET    | `/health`            | Healthcheck                  |
| GET    | `/api/empresas`      | Lista empresas (com filtros) |
| GET    | `/api/empresas/{id}` | Detalhes de empresa          |
| GET    | `/api/licencas`      | Lista licenças               |
| GET    | `/api/taxas`         | Lista taxas                  |
| GET    | `/api/processos`     | Lista processos              |
| GET    | `/api/kpis`          | KPIs do painel               |
| GET    | `/api/municipios`    | Lista municípios             |
| POST   | `/api/refresh`       | Recarrega dados do Excel     |

**Query params (empresas)**:

* `query`: Busca livre
* `municipio`: Filtro por município
* `so_alertas`: Boolean (true/false)

---

## Segurança e Boas Práticas

1. **NUNCA versionar** `data/arquivo.xlsm` no Git
2. **Usar variáveis de ambiente** para caminhos sensíveis
3. **Implementar autenticação** antes de produção
4. **Backup automático** do Excel antes de cada escrita
5. **Rate limiting** nos endpoints (usar `slowapi`)
6. **HTTPS** em produção
7. **Logs estruturados** para auditoria

---

## Próximos Passos

* [x] Migrar estrutura do frontend para TypeScript
* [x] Incluir `badge` e `label` no shadcn/ui
* [x] Adicionar `src/index.css` com Tailwind
* [x] Configurar alias `@` no `vite.config.ts`
* [ ] Implementar `/api/diagnostico` (mapeamento abas/colunas)
* [ ] `portalocker` no `repo_excel.py` (lock de arquivo)
* [ ] Testes unitários: `test_repo.py`, `test_services.py`, `test_api.py`
* [ ] Autenticação (JWT) e CORS via `.env`
* [ ] Docker Compose para dev/prod

---

## Troubleshooting

**Backend não conecta ao Excel**:

* Verificar caminho em `.env`
* Verificar permissões do arquivo
* Fechar Excel se estiver aberto

**CORS error no frontend**:

* Verificar `allow_origins` em `api.py`
* Verificar porta do Vite (5173)

**Componentes shadcn/ui não encontrados**:

```bash
cd frontend
npx shadcn-ui@latest init
npx shadcn-ui@latest add card button input select tabs table switch scroll-area separator badge label
```