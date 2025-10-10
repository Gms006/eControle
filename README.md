# eControle

Sistema interno para gestão integrada de empresas, licenças, taxas, processos administrativos, certificados digitais e materiais de apoio. O fluxo atual é:

1. **Planilhas Excel macro-enabled (.xlsm)** com abas e ListObjects padronizados abastecem as entidades de negócio.
2. **Backend FastAPI** importa os dados via `ExcelRepo`, normaliza-os e mantém um cache em memória.
3. **Frontend React + Vite** consome os endpoints REST para montar dashboards, listagens com filtros e cards interativos.

> **Importante:** os arquivos Excel reais **não devem ser versionados**. Crie a pasta `data/` localmente e mantenha os `.xlsm` apenas em ambientes controlados.

---

## Arquitetura em alto nível

```
┌─────────────────────────┐        ┌─────────────────────────────┐
│ Excel (.xlsm) +         │        │ backend/config.yaml         │
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
│ backend/api.py (FastAPI) + routes_certificados.py             │
│ • Endpoints REST (/api/*, /api/certificados, /health, etc.)   │
│ • Normalização via backend/services/__init__.py               │
│ • KPIs globais e filtros reutilizáveis                        │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP (CORS configurável)
                ▼
┌──────────────────────────────────────────────────────────────┐
│ frontend (React 18 + Vite)                                   │
│ • App.jsx com tabs (Painel, Empresas, Licenças, Taxas, ...)   │
│ • Hooks para busca, filtros, modo foco, certificados          │
│ • Componentes shadcn/ui + gráficos com Recharts               │
└──────────────────────────────────────────────────────────────┘
```

---

## Estrutura do repositório

```
.
├── backend/
│   ├── api.py                  # API FastAPI + cache em memória
│   ├── repo_excel.py           # Acesso seguro ao Excel (portalocker/openpyxl)
│   ├── models.py               # Dataclasses de domínio
│   ├── services/
│   │   ├── __init__.py         # Normalização, filtros, métricas e validações
│   │   └── data_certificados.py # Leitura de certificados/agenda em planilha dedicada
│   ├── routes_certificados.py  # Rotas adicionais (/api/certificados, /api/agendamentos)
│   ├── config.yaml             # Nomes de abas/tabelas + aliases de colunas
│   └── requirements.txt        # Dependências do backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx, main.jsx, index.css
│   │   ├── components/         # shadcn/ui wrappers + badges/KPIs
│   │   ├── features/           # Telas: painel, empresas, licenças, taxas, processos, úteis, certificados
│   │   ├── lib/                # Helpers (API, texto, status, certificados, constantes)
│   │   └── providers/          # ToastProvider e contexto de notificações
│   ├── package.json, vite.config.js, tailwind.config.js
│   └── postcss.config.js, index.html
├── ESTRUTURA_PROJETO.md        # Blueprint histórico do projeto
├── GUIA_SETUP.md               # Passo a passo detalhado (legado)
└── README.md                   # Este documento
```

---

## Planilhas e configuração

O backend utiliza duas planilhas principais:

1. **Planilha operacional** – definida pela variável `EXCEL_PATH` (ex.: `../data/arquivo.xlsm`). Alimenta empresas, licenças, taxas, processos e contatos.
2. **Planilha de certificados** – caminho configurado em `backend/services/data_certificados.py` (constante `PLANILHA_CERT_PATH`). Deve apontar para o arquivo `.xlsm` que contém certificados digitais e agenda de emissão.

O arquivo `backend/config.yaml` controla nomes de abas (`sheet_names`), tabelas/ListObjects (`table_names`), aliases de colunas (`column_aliases`) e enumerações auxiliares (`enums`). Ajuste-o sempre que a estrutura da planilha mudar.

---

## Backend (FastAPI)

### Principais responsabilidades

- Carregar a planilha principal via `ExcelRepo` com lock de arquivo (`portalocker`).
- Transformar estruturas “largas” de licenças e taxas em listas normalizadas (`Licenca`, `Taxa`).
- Consolidar processos a partir de múltiplas tabelas (diversos, funcionamento, bombeiros, uso do solo, sanitário, ambiental).
- Manter um **cache global** com empresas, licenças, taxas, processos, contatos e modelos.
- Expor endpoints REST (incluindo certificados/agendamentos) e rota de diagnóstico de colunas.
- Calcular métricas agregadas para o painel (`/api/kpis`).

### Variáveis de ambiente

Crie um arquivo `.env` dentro de `backend/` com as chaves mínimas:

```ini
EXCEL_PATH=../data/arquivo.xlsm   # Caminho absoluto ou relativo da planilha principal
CONFIG_PATH=./config.yaml         # Opcional: customizar mapeamento
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
```

> Ajuste `PLANILHA_CERT_PATH` em `services/data_certificados.py` conforme o local da planilha de certificados.

### Instalação e execução

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn api:app --reload --host $API_HOST --port $API_PORT
```

### Endpoints principais

| Método | Caminho                 | Descrição                                                                      |
| ------ | ----------------------- | ------------------------------------------------------------------------------ |
| GET    | `/`                     | Metadados da API + timestamp da última carga                                   |
| GET    | `/health`               | Healthcheck simples + quantidade de empresas em cache                          |
| GET    | `/api/empresas`         | Lista empresas (filtros `query`, `municipio`, `so_alertas`)                     |
| GET    | `/api/empresas/{id}`    | Detalhe da empresa + contagem de licenças/processos/taxas                       |
| GET    | `/api/licencas`         | Licenças normalizadas (filtros `empresa_id`, `empresa`)                         |
| GET    | `/api/taxas`            | Taxas normalizadas por empresa                                                  |
| GET    | `/api/processos`        | Processos (diversos, funcionamento, bombeiros, uso do solo, sanitário, etc.)    |
| GET    | `/api/municipios`       | Lista de municípios deduplicados                                                |
| GET    | `/api/kpis`             | KPIs globais (empresas, licenças vencidas, TPI pendente, etc.)                 |
| GET    | `/api/uteis`            | Contatos e modelos de mensagem                                                  |
| GET    | `/api/certificados`     | Certificados digitais extraídos da planilha dedicada                             |
| GET    | `/api/agendamentos`     | Agenda de emissões de certificados                                              |
| POST   | `/api/refresh`          | Agenda recarga assíncrona do Excel                                              |
| GET    | `/api/diagnostico`      | Mapas de colunas detectados + avisos de colunas ausentes                        |

### Diagnóstico rápido

```bash
cd backend
python repo_excel.py          # Imprime mapas de colunas e tabelas configuradas
curl http://localhost:8000/health
curl http://localhost:8000/api/diagnostico | jq
```

As funções `ExcelRepo.build_column_map*` ajudam a verificar se novas colunas foram reconhecidas.

---

## Frontend (React + Vite)

### Destaques da interface

- **Tabs com atalhos (Alt+1…7)** para navegar entre Painel, Empresas, Licenças, Taxas, Processos, Certificados e Úteis.
- **Filtros combinados** (busca textual, município, modo “somente alertas”) que impactam múltiplas telas simultaneamente.
- **Modo foco** reduzindo densidade visual em listagens extensas.
- **Painel analítico** com cartões (`KPI`), gráficos (`Recharts`) e destaques de risco/alertas.
- **Integração com certificados** para cruzar situação do certificado digital com os dados das empresas.
- **Toasts leves** (`ToastProvider`) para feedback de ações de cópia e interações rápidas.
- Componentes baseados em shadcn/ui (button, card, table, tabs, switch, select, etc.) estilizados via Tailwind CSS.

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

O script `npm run dev` inicia o Vite com `--open`. Ajuste `VITE_API_URL` conforme a URL de produção ou túnel.

Para gerar build de produção:

```bash
npm run build    # gera frontend/dist
npm run preview  # testa build localmente
```

---

## Boas práticas

- Feche o Excel antes de iniciar o backend (o `ExcelRepo` usa lock compartilhado via `portalocker`).
- Utilize o endpoint `/api/diagnostico` sempre que alterar cabeçalhos ou nomes de tabelas para confirmar o mapeamento.
- Centralize novas regras de negócio em `backend/services/__init__.py` para manter o front simples e reutilizar lógica.
- No frontend, reutilize os utilitários existentes em `src/lib/*` (texto, status, certificados, processos) antes de criar novos helpers.
- Consulte `GUIA_SETUP.md` para um passo a passo histórico (comandos de Tailwind/shadcn) e `ESTRUTURA_PROJETO.md` para uma visão arquitetural complementar.

---

## Próximos passos sugeridos

- Externalizar `PLANILHA_CERT_PATH` via variável de ambiente para evitar ajustes manuais em código.
- Adicionar testes automatizados para as funções críticas de normalização e filtros (`backend/services`, `frontend/src/lib`).
- Documentar um fluxo de implantação (Docker Compose, CI/CD) que mantenha os arquivos Excel fora do repositório.

