# eControle

Sistema interno para gestão integrada de empresas, licenças, taxas, processos administrativos e materiais de apoio. O fluxo principal é:

1. **Excel macro-enabled (.xlsm)** com abas e tabelas padronizadas é lido pelo backend.
2. **Backend FastAPI** (Python) usa `ExcelRepo` para importar, normalizar e manter os dados em cache em memória.
3. **Frontend React + Vite** consome os endpoints REST e monta dashboards, listagens com filtros e cards interativos.

> **Importante:** o arquivo Excel real **não deve ser versionado**. Crie a pasta `data/` localmente e mantenha o `.xlsm` apenas em ambientes controlados.

---

## Arquitetura em alto nível

```
┌─────────────────────────┐        ┌─────────────────────────────┐
│ Excel (.xlsm) +         │        │ config.yaml                 │
│ ListObjects + abas      │        │ aliases / nomes de abas     │
└───────────────┬─────────┘        └──────────────┬──────────────┘
                │                                 │
        portalocker + openpyxl                    │
                ▼                                 │
┌─────────────────────────────────────────────────▼──────────────┐
│ backend/repo_excel.py (ExcelRepo)                              │
│ • Lock de arquivo (.env → EXCEL_PATH)                          │
│ • Mapeamento dinâmico de colunas/abas/tabelas                  │
│ • Leitura por aba e por tabela (ListObject)                    │
└───────────────┬────────────────────────────────────────────────┘
                │                                               cache em memória
                ▼
┌──────────────────────────────────────────────────────────────┐
│ backend/api.py (FastAPI)                                     │
│ • Endpoints REST (/api/*, /health, /api/diagnostico)          │
│ • Normalização via services.py (licenças, taxas, processos)   │
│ • KPIs globais e filtros reutilizáveis                        │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP (CORS configurável)
                ▼
┌──────────────────────────────────────────────────────────────┐
│ frontend (React 18 + Vite)                                   │
│ • App.jsx com tabs (Painel, Empresas, Licenças, Taxas, etc.)  │
│ • Hooks para busca, filtros, modo foco e toasts               │
│ • Componentes shadcn/ui + gráficos com Recharts               │
└──────────────────────────────────────────────────────────────┘
```

---

## Estrutura do repositório

```
.
├── backend/
│   ├── api.py             # Endpoints FastAPI + cache em memória
│   ├── repo_excel.py      # Repositório Excel com portalocker/openpyxl
│   ├── services.py        # Validações, normalização e métricas
│   ├── models.py          # Dataclasses de domínio
│   ├── config.yaml        # Nomes de abas/tabelas + aliases de colunas
│   └── requirements.txt   # Dependências do backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx, main.jsx, index.css
│   │   ├── features/      # Telas (painel, empresas, licenças, taxas, ...)
│   │   ├── components/    # shadcn/ui wrappers + badges/custom UI
│   │   ├── lib/           # helpers (API, texto, status, constantes)
│   │   └── providers/     # ToastProvider (notificações)
│   ├── package.json, vite.config.js, tailwind.config.js
│   └── postcss.config.js, index.html
├── ESTRUTURA_PROJETO.md   # Blueprint original do projeto
├── GUIA_SETUP.md          # Passo a passo detalhado (histórico)
└── README.md              # Este documento
```

---

## Backend (FastAPI)

### Principais responsabilidades

- Carregar o `.xlsm` informado em `EXCEL_PATH` usando `ExcelRepo` (locking com `portalocker`).
- Normalizar a estrutura "larga" do Excel para objetos específicos (`Licenca`, `Taxa`, `Processo`, etc.).
- Manter um **cache global** em memória (listas de empresas, licenças, taxas, processos, contatos e modelos).
- Expor endpoints REST para consulta e diagnóstico (`/api/diagnostico` reconstrói mapas de colunas/aliases).
- Calcular métricas agregadas para o painel (`/api/kpis`).

### Variáveis de ambiente

Crie um arquivo `.env` dentro de `backend/`:

```ini
EXCEL_PATH=../data/arquivo.xlsm   # Caminho absoluto ou relativo
CONFIG_PATH=./config.yaml         # Opcional: customizar mapeamento
CORS_ORIGINS=http://localhost:5173
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
```

### Instalação e execução

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload --host $API_HOST --port $API_PORT
```

### Endpoints principais

| Método | Caminho             | Descrição                                                                    |
| ------ | ------------------- | ---------------------------------------------------------------------------- |
| GET    | `/`                 | Metadados da API + timestamp da última carga                                |
| GET    | `/health`           | Healthcheck simples + quantidade de empresas em cache                       |
| GET    | `/api/empresas`     | Lista empresas (filtros `query`, `municipio`, `so_alertas`)                  |
| GET    | `/api/empresas/{id}`| Detalhe da empresa + contagem de licenças/processos/taxas                    |
| GET    | `/api/licencas`     | Licenças normalizadas (filtros `empresa_id`, `empresa`)                      |
| GET    | `/api/taxas`        | Taxas normalizadas por empresa                                               |
| GET    | `/api/processos`    | Processos (diversos, funcionamento, bombeiros, uso do solo, sanitário, etc.) |
| GET    | `/api/municipios`   | Lista de municípios deduplicados                                             |
| GET    | `/api/kpis`         | KPIs globais (empresas, licenças vencidas, TPI pendente, etc.)              |
| GET    | `/api/uteis`        | Contatos e modelos de mensagem                                               |
| POST   | `/api/refresh`      | Agenda recarga assíncrona do Excel                                           |
| GET    | `/api/diagnostico`  | Mapas de colunas detectados + avisos de colunas ausentes                     |

### Diagnóstico rápido

```bash
cd backend
python repo_excel.py          # Imprime mapas de colunas e tabelas configuradas
curl http://localhost:8000/health
curl http://localhost:8000/api/diagnostico | jq
```

---

## Frontend (React + Vite)

### Destaques da interface

- **Tabs com atalhos (Alt+1…6)** para navegar entre Painel, Empresas, Licenças, Taxas, Processos e Úteis.
- **Filtros combinados**: busca textual, município, modo "somente alertas" (integra status de licenças, taxas e processos).
- **Modo foco** que reduz densidade visual nas telas de licenças/taxas/processos.
- **Painel analítico** com cartões, gráficos (`Recharts`), contagens agregadas e destaques de risco.
- **Toasts leves** (`ToastProvider`) para feedback de cópia/ações rápidas.
- Componentes baseados em shadcn/ui (button, card, table, tabs, switch, select, etc.) estilizados via Tailwind.

### Configuração

```bash
cd frontend
npm install
npm run dev
```

Crie um arquivo `frontend/.env` (ou configure via shell) para apontar o backend:

```bash
VITE_API_URL=http://localhost:8000/api
```

> Se não informado, o helper `normalizeApiBase` cai no fallback `/api`, útil quando o frontend é servido pelo mesmo host do backend (ex.: FastAPI montando `StaticFiles`).

### Build de produção

```bash
npm run build           # gera frontend/dist
npm run preview         # testa build localmente
```

Para servir os arquivos estáticos via FastAPI, monte `StaticFiles` apontando para `../frontend/dist`.

---

## Estrutura do Excel e configuração (`backend/config.yaml`)

- `sheet_names`: nomes reais das abas (EMPRESAS, LICENÇAS, TAXAS, PROCESSOS, CONTATOS E MODELOS).
- `table_names`: mapeia ListObjects específicos dentro da aba PROCESSOS e da aba de Úteis.
- `column_aliases`: aliases por aba/tabela (normalização de cabeçalhos com/sem acentos, variações de nomenclatura).
- `enums`: opções padronizadas para dropdowns/validações (status, órgãos, tipos de serviços, etc.).

`ExcelRepo` tenta identificar a linha de cabeçalho automaticamente (até 10 primeiras linhas) e suporta leitura tanto de abas simples quanto de tabelas nomeadas. Colunas sem correspondência geram avisos no endpoint `/api/diagnostico`.

---

## Troubleshooting

- **Erro ao abrir o Excel / arquivo bloqueado**: garanta que o `.xlsm` esteja fechado e que `EXCEL_PATH` aponte corretamente para o arquivo.
- **Endpoint retorna vazio**: revise `config.yaml` (aliases e nomes de abas) e execute `python repo_excel.py` para conferir o mapeamento.
- **CORS no navegador**: ajuste `CORS_ORIGINS` no `.env` do backend para incluir a URL do Vite (`http://localhost:5173`).
- **Frontend não encontra API**: confirme `VITE_API_URL` ou utilize o proxy reverso do próprio backend (montando arquivos estáticos e expondo `/api`).

---

## Próximos passos sugeridos

- Autenticação/autorização (JWT) e segregação de permissões por usuário.
- Testes automatizados para `services.py`, `api.py` e fluxo de integração.
- Docker Compose com serviços backend/frontend e volume compartilhado para `data/`.
- Exportação/importação incremental do Excel (logs de alterações, histórico).
- Observabilidade: logs estruturados e métricas (Prometheus) para monitoramento do cache e tempo de resposta.

---

## Licença

Uso interno e restrito. Consulte a direção do projeto antes de distribuir ou reutilizar este código.
