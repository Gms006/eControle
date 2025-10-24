# eControle

Sistema interno para gestão de empresas, licenças, taxas, processos administrativos, certificados digitais e materiais de apoio. O fluxo completo envolve uma planilha Excel macro-enabled (.xlsm), um backend FastAPI que normaliza os dados em memória e um frontend React que apresenta painéis, filtros e automações.

> Os arquivos reais das planilhas **não são versionados**. Crie a pasta `data/` localmente e armazene os `.xlsm` apenas em ambientes controlados.

---

## Visão geral dos componentes

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ Planilhas Excel (.xlsm)     │        │ backend/config.yaml          │
│ • Abas com ListObjects      │        │ sheet/table aliases          │
└──────────────┬──────────────┘        └──────────────┬───────────────┘
               │                                     │
       portalocker + openpyxl                        │
               ▼                                     │
┌────────────────────────────────────────────────────▼──────────────┐
│ backend/repo_excel.py (ExcelRepo)                                 │
│ • Lock do arquivo (.env → EXCEL_PATH)                             │
│ • Mapas dinâmicos de colunas/abas/tabelas                         │
│ • Leitura por aba ou ListObject                                   │
└──────────────┬────────────────────────────────────────────────────┘
               │                                 cache em memória
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ backend/api.py (FastAPI)                                         │
│ • Endpoints REST (/api/*, /api/cnds, /api/cae, /api/certificados) │
│ • Normalização em services/ + métricas globais                    │
│ • Exposição de PDFs gerados em `/cnds`                            │
└──────────────┬───────────────────────────────────────────────────┘
               │ HTTP (CORS configurável)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ frontend (React 18 + Vite + Tailwind)                            │
│ • Abas: Painel, Empresas, Licenças, Taxas, Processos, Úteis,      │
│   Certificados                                                    │
│ • Hooks para filtros, alertas e automações (CND/CAE)              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do repositório

```
.
├── backend/
│   ├── api.py                   # API FastAPI + cache em memória
│   ├── repo_excel.py            # Acesso seguro às planilhas
│   ├── models.py                # Dataclasses de domínio
│   ├── services/
│   │   ├── __init__.py          # Normalização, filtros, métricas
│   │   └── data_certificados.py # Leitura da planilha de certificados
│   ├── routes_certificados.py   # Rotas /api/certificados e /api/agendamentos
│   ├── cnds/                    # Automação de CNDs (Playwright)
│   ├── caes/                    # Automação de CAE (Playwright)
│   ├── config.yaml              # Mapeamento de abas/tabelas/aliases
│   └── requirements.txt         # Dependências do backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx, main.jsx, index.css
│   │   ├── components/          # shadcn/ui wrappers, badges, KPIs
│   │   ├── features/            # Telas (painel, empresas, licenças, ...)
│   │   ├── lib/                 # Helpers (API, texto, status, certificados)
│   │   └── providers/           # ToastProvider e contexto de notificações
│   ├── package.json, vite.config.js, tailwind.config.js
│   └── postcss.config.js, index.html
├── ESTRUTURA_PROJETO.md        # Blueprint resumido do repositório
├── GUIA_SETUP.md               # Passo a passo detalhado de setup
└── README.md                   # Este documento
```

---

## Setup rápido

1. **Backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
   pip install -r requirements.txt
   python -m playwright install chromium  # necessário para automações
   ```

2. **Configuração**
   - Crie `backend/.env` com, no mínimo:
     ```ini
     EXCEL_PATH=../data/arquivo.xlsm
     CONFIG_PATH=./config.yaml
     CORS_ORIGINS=http://localhost:5173
     API_HOST=0.0.0.0
     API_PORT=8000
     LOG_LEVEL=INFO
     CND_DIR_BASE=certidoes
     CND_HEADLESS=true
     CAPTCHA_MODE=manual          # ou image_2captcha
     API_KEY_2CAPTCHA=            # obrigatório se CAPTCHA_MODE=image_2captcha
     ```
   - Ajuste `PLANILHA_CERT_PATH` em `backend/services/data_certificados.py` para apontar para a planilha de certificados/agendamentos.

3. **Executar o backend**
   ```bash
   uvicorn api:app --reload --host $API_HOST --port $API_PORT
   ```

4. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - O Vite roda em `http://localhost:5173` e proxia chamadas `/api` para `http://localhost:8000`.
   - Defina `VITE_API_URL` em um `.env.local` se precisar apontar para outra origem.

---

## Backend FastAPI

### Responsabilidades principais

- Carregar a planilha definida em `EXCEL_PATH` via `ExcelRepo` com bloqueio de arquivo (`portalocker`).
- Normalizar as estruturas "largas" de licenças e taxas em listas (`Licenca`, `Taxa`).
- Consolidar processos a partir das tabelas definidas em `config.yaml`.
- Popular um cache global com empresas, licenças, taxas, processos, contatos e modelos de mensagem.
- Expor endpoints REST (incluindo certificados, agendamentos, automação de CNDs e CAE).
- Calcular KPIs agregados para o painel (`/api/kpis`).
- Servir PDFs de CND gerados em `/cnds/*` via `StaticFiles`.

### Endpoints relevantes

| Método | Caminho                    | Descrição                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------- |
| GET    | `/`                        | Metadados da API + timestamp da última carga                              |
| GET    | `/health`                  | Healthcheck simples                                                       |
| GET    | `/api/empresas`            | Lista empresas com filtros (`query`, `municipio`, `so_alertas`)           |
| GET    | `/api/empresas/{id}`       | Detalhe da empresa + contagens de licenças/processos/taxas                |
| GET    | `/api/licencas`            | Licenças normalizadas (`empresa_id` ou `empresa`)                         |
| GET    | `/api/taxas`               | Situação das taxas por empresa                                            |
| GET    | `/api/processos`           | Processos agrupados por tipo (`tipo`, `apenas_ativos`)                    |
| GET    | `/api/uteis`               | Contatos e modelos de mensagem                                            |
| GET    | `/api/municipios`          | Municípios deduplicados                                                   |
| GET    | `/api/kpis`                | KPIs globais do painel                                                    |
| POST   | `/api/refresh`             | Agenda recarga assíncrona do Excel                                        |
| GET    | `/api/diagnostico`         | Mapas de colunas detectados + avisos                                      |
| GET    | `/api/certificados`        | Certificados digitais da planilha dedicada                                |
| GET    | `/api/agendamentos`        | Agenda de emissões                                                        |
| POST   | `/api/cnds/emitir`         | Emissão automática de CND (múltiplos municípios suportados)               |
| GET    | `/api/cnds/{cnpj}/list`    | Lista PDFs de CND já emitidos                                             |
| POST   | `/api/cae/emitir`          | Emissão automática de CAE (Anápolis)                                      |

### Planilhas e `config.yaml`

- `config.yaml` define `sheet_names`, `table_names`, `column_aliases` e enums auxiliares.
- Ajuste os aliases sempre que um cabeçalho da planilha mudar; o diagnóstico (`/api/diagnostico`) ajuda a validar o mapeamento.
- A planilha principal deve conter, pelo menos, abas para empresas, licenças, taxas, processos e contatos/modelos.

### Automação de CND/CAE

- **CNDs**: use as rotas em `backend/cnds/municipal`. Variáveis de ambiente úteis:
  - `CND_DIR_BASE`: diretório onde os PDFs ficam salvos (padrão: `certidoes/`).
  - `CND_HEADLESS`: controla se o Playwright roda em headless.
  - `CND_CHROME_PATH`: caminho para um executável Chromium customizado (opcional).
  - `CAPTCHA_MODE` + `API_KEY_2CAPTCHA`: habilitam resolução automática de captcha.
- **CAE**: disponível para Anápolis em `/api/cae/emitir` via `backend/caes/cae_worker_anapolis.py`.
- Execute `python -m playwright install chromium` após instalar as dependências ou sempre que atualizar o Playwright.

---

## Frontend React

- Construído com **React 18**, **Vite**, **Tailwind** e componentes estilo shadcn/ui (arquivos `.jsx`).
- O estado global vive no `App.jsx`, que carrega dados via hooks (`fetchJson`) e distribui para as abas.
- Principais diretórios:
  - `features/painel`: KPIs, métricas e gráficos (Recharts) com tendência de alertas.
  - `features/empresas`: filtros rápidos, modo foco e destaques de alertas.
  - `features/licencas`, `features/taxas`, `features/processos`: listagens com filtros reutilizáveis.
  - `features/certificados`: leitura da planilha dedicada (certificados e agendamentos).
  - `features/uteis`: contatos e modelos de mensagem.
- Configure `VITE_API_URL` para apontar para o backend desejado em produção (ex.: `https://minha.api/econtrole`).

### Desenvolvimento

- Hot reload automático do Vite (`npm run dev`).
- O proxy configurado em `vite.config.js` permite rodar backend e frontend localmente sem ajustes adicionais.
- Use o ToastProvider (`providers/ToastProvider.jsx`) para notificações consistentes.

---

## Dicas de manutenção

- Utilize `/api/refresh` para recarregar o cache após atualizar a planilha.
- O endpoint `/api/diagnostico` ajuda a detectar colunas renomeadas ou ausentes.
- Monitorar `backend/logs` (stdout) com `LOG_LEVEL=DEBUG` facilita depuração de automações Playwright.
- Os PDFs gerados ficam em `CND_DIR_BASE` e são servidos diretamente pelo backend (`/cnds/arquivo.pdf`).

---

## Licença

Projeto interno. Consulte o time responsável antes de distribuir.
