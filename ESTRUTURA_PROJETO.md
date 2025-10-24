# Estrutura do Projeto eControle

Visão rápida de onde cada responsabilidade mora. Use este guia como mapa para navegar no repositório.

```
eControle/
├── backend/                         # Backend FastAPI + integrações com Excel
│   ├── api.py                       # Criação da app, cache de dados, endpoints REST
│   ├── repo_excel.py                # Classe ExcelRepo (openpyxl + portalocker)
│   ├── models.py                    # Dataclasses de domínio (Empresa, Licenca, ...)
│   ├── services/
│   │   ├── __init__.py              # Normalizações, filtros e cálculos de KPIs
│   │   └── data_certificados.py     # Leitura da planilha de certificados/agendamentos
│   ├── routes_certificados.py       # Rotas `/api/certificados` e `/api/agendamentos`
│   ├── cnds/                        # Automatizações de CND (Playwright)
│   │   ├── municipal/               # Workers por município + mapeamentos JSON
│   │   └── __init__.py              # Router FastAPI
│   ├── caes/                        # Automação de emissão de CAE
│   │   ├── cae_worker_anapolis.py   # Worker Playwright para Anápolis
│   │   └── routes.py                # Router `/api/cae`
│   ├── config.yaml                  # Nomes de abas/tabelas e aliases de colunas
│   └── requirements.txt             # Dependências Python (rodar `pip install -r`)
│
├── frontend/                        # Frontend React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx                  # Componente raiz com abas e estados globais
│   │   ├── main.jsx                 # Entry point (ReactDOM.createRoot)
│   │   ├── index.css                # Tailwind + estilos globais
│   │   ├── components/              # shadcn/ui wrappers, badges, KPIs, HeaderMenu
│   │   ├── features/                # Telas (painel, empresas, licenças, taxas, ...)
│   │   ├── lib/                     # Helpers (API, certificados, texto, status)
│   │   └── providers/               # ToastProvider e contexto de notificações
│   ├── package.json                 # Dependências npm
│   ├── vite.config.js               # Build + alias `@` + proxy /api
│   ├── tailwind.config.js           # Design system utilitário
│   ├── postcss.config.js            # Integração Tailwind
│   └── index.html                   # HTML base
│
├── README.md                        # Visão geral e instruções rápidas
├── GUIA_SETUP.md                    # Passo a passo detalhado de instalação
└── ESTRUTURA_PROJETO.md             # Este mapa rápido
```

## Fluxo resumido

1. Planilhas `.xlsm` abastecem as entidades de negócio (empresas, licenças, taxas, processos, contatos, certificados).
2. `backend/repo_excel.py` abre as planilhas com `keep_vba=True`, aplica aliases de `config.yaml` e gera estruturas normalizadas.
3. `backend/api.py` carrega os dados para um cache em memória e expõe endpoints REST.
4. `frontend/src/App.jsx` consome os endpoints via `fetchJson`, disponibilizando os dados para as telas em `features/`.
5. Automação opcional (CND/CAE) usa Playwright para baixar PDFs e salvá-los em `CND_DIR_BASE`, servidos em `/cnds/*`.

## Convenções

- Arquivos `.xlsm` ficam fora do versionamento em `data/`.
- Variáveis sensíveis (caminho da planilha, 2Captcha, etc.) vivem no `.env` do backend.
- O frontend considera `VITE_API_URL` (ou o proxy do Vite em desenvolvimento) para apontar para o backend.
