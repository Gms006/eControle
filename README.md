# eControle

Sistema interno para gestão de empresas, licenças, taxas e processos administrativos. O backend em **FastAPI** lê um
arquivo Excel macro-enabled (`.xlsm`) e expõe endpoints REST; o frontend em **React + Vite** consome essas APIs para
montar dashboards e listagens interativas.

## Visão geral

- **Importação única de dados** a partir de um arquivo Excel configurável (`backend/config.yaml`).
- **Cache em memória** para evitar leituras constantes do Excel e melhorar a performance dos endpoints.
- **Filtros de negócios** para empresas, licenças, taxas e processos (status, município, buscas livres, etc.).
- **Painel analítico** com KPIs e componentes reutilizáveis baseados em Radix UI / shadcn.

## Stack principal

| Área      | Tecnologias                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| Backend   | Python 3.10+, FastAPI, Pydantic v2, Uvicorn, OpenPyXL, Portalocker           |
| Frontend  | React 18, Vite, Tailwind CSS, Radix UI, Lucide Icons, Recharts               |
| Configuração | Arquivo Excel `.xlsm` + `backend/config.yaml` para mapeamento de abas e colunas |

## Estrutura do repositório

```
.
├── backend/
│   ├── api.py              # Endpoints FastAPI e cache em memória
│   ├── models.py           # Modelos de domínio (dataclasses)
│   ├── repo_excel.py       # Leitura/normalização das planilhas Excel
│   ├── services.py         # Funções de filtragem, agregação e KPIs
│   ├── config.yaml         # Mapeamento de abas e aliases de colunas
│   └── requirements.txt    # Dependências do backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx, main.jsx, index.css
│   │   ├── components/ui/  # Componentes (badge, button, card, input, etc.)
│   │   └── lib/utils.js
│   ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js
│   └── index.html
├── data/                   # NÃO versionar (contém o arquivo Excel real)
├── ESTRUTURA_PROJETO.md    # Descrição detalhada da arquitetura
├── GUIA_SETUP.md           # Passo a passo expandido de configuração
└── README.md
```

## Pré-requisitos

- Python 3.10 ou superior
- Node.js 18 LTS ou superior + npm
- Arquivo Excel `.xlsm` com abas e colunas compatíveis (ver seção **Estrutura do Excel**)

## Configuração rápida

### 1. Backend (FastAPI)

```bash
cd backend

# Ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Dependências
pip install -r requirements.txt
```

Crie um arquivo `.env` em `backend/` (o backend carrega automaticamente na inicialização):

```bash
EXCEL_PATH=../data/arquivo.xlsm   # caminho absoluto ou relativo para o Excel
CORS_ORIGINS=http://localhost:5173
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
```

Execute o servidor:

```bash
uvicorn api:app --reload --host $API_HOST --port $API_PORT
```

A API ficará disponível em `http://localhost:8000`.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

O Vite abrirá o navegador em `http://localhost:5173`. Garanta que o backend esteja em execução para que as requisições
de dados funcionem.

### 3. Fluxo de desenvolvimento sugerido

- Terminal 1: `cd backend && uvicorn api:app --reload`
- Terminal 2: `cd frontend && npm run dev`

Para inspeções rápidas dos dados carregados do Excel:

```bash
cd backend
python repo_excel.py
```

## Estrutura do Excel

O arquivo Excel pode ter nomes de abas customizados; o mapeamento padrão está em `backend/config.yaml`. As principais
abas esperadas são:

- **EMPRESAS** – dados cadastrais (ID, empresa, CNPJ, município, situação, certificados, contatos, etc.).
- **LICENÇAS** – status por tipo de licença (sanitária, funcionamento, ambiental, uso do solo, etc.).
- **TAXAS** – status das taxas municipais (funcionamento, publicidade, sanitária, bombeiros, TPI...).
- **Diversos / Processos** – protocolos e andamento de processos administrativos.

A primeira linha com cabeçalhos deve estar na linha 2 (há heurísticas para detectar, mas essa é a convenção adotada). O
arquivo **não pode estar aberto** enquanto o backend estiver lendo ou gravando para evitar bloqueios de arquivo.

## Endpoints principais

| Método | Caminho               | Descrição                                                                 |
| ------ | --------------------- | ------------------------------------------------------------------------- |
| GET    | `/`                   | Metadados básicos da API e data do último carregamento                    |
| GET    | `/health`             | Healthcheck simples                                                       |
| GET    | `/api/empresas`       | Lista empresas com filtros (`query`, `municipio`, `so_alertas`)           |
| GET    | `/api/empresas/{id}`  | Detalhes completos de uma empresa e seus agregados                        |
| GET    | `/api/licencas`       | Licenças normalizadas por empresa e tipo                                  |
| GET    | `/api/taxas`          | Situação das taxas por empresa                                            |
| GET    | `/api/processos`      | Processos em andamento ou concluídos                                      |
| GET    | `/api/kpis`           | Indicadores do painel (total de empresas, licenças vencidas, etc.)        |
| GET    | `/api/municipios`     | Lista única de municípios cadastrados                                     |
| POST   | `/api/refresh`        | Recarrega manualmente o Excel e atualiza o cache                          |
| GET    | `/api/diagnostico`    | Expõe o mapeamento de colunas e status detectados (útil para depuração)   |

## Troubleshooting

- **Backend não inicia / erro de arquivo**
  - Confirme o caminho em `EXCEL_PATH` e se o arquivo existe.
  - Feche o Excel local antes de iniciar o backend (para evitar lock).
- **Erro de CORS no frontend**
  - Ajuste `CORS_ORIGINS` no `.env` do backend para incluir a URL do Vite.
- **Dados vazios ou incompletos**
  - Rode `python repo_excel.py` para verificar como as colunas estão sendo mapeadas.
  - Ajuste `backend/config.yaml` adicionando aliases ou novos nomes de abas.

## Próximos passos sugeridos

- Implementar camadas de autenticação (JWT) e autorização.
- Versionar testes automatizados para `repo_excel`, `services` e endpoints da API.
- Adicionar Docker Compose para orquestrar backend, frontend e dependências.
- Publicar documentação interativa com `FastAPI`/`Swagger` e exemplos de payloads reais.

## Licença

Uso interno e restrito. Consulte a direção do projeto antes de distribuir ou reutilizar este código.
