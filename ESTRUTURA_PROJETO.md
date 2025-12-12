# Estrutura do Projeto eControle

Mapa rápido das principais pastas e responsabilidades. Para saber como instalar e executar, consulte o [`GUIA_SETUP.md`](GUIA_SETUP.md); para a visão geral da arquitetura, veja o [`README.md`](README.md).

```
eControle/
├── backend/                        # Backend FastAPI + ETL + integrações
│   ├── main.py                     # Entrada da API v1 (uvicorn backend.main:app)
│   ├── app/                        # Código da API (rotas v1, dependências, config)
│   │   ├── api/v1/                 # Routers e endpoints
│   │   ├── core/                   # Settings carregados do .env/config.yaml
│   │   ├── db/                     # Sessão SQLAlchemy
│   │   └── deps/                   # Autenticação JWT e contexto multi-tenant
│   ├── db/                         # Modelos SQLAlchemy e enums
│   ├── migrations/                 # Alembic (schema, staging e views)
│   ├── etl/                        # Pipeline de normalização + CLI Typer
│   ├── cnds/, caes/                # Automação Playwright para CND/CAE
│   ├── scripts/dev/mint_jwt.py     # Gera JWT de desenvolvimento
│   ├── requirements.txt            # Dependências Python para API/ETL/Playwright
│   └── config.yaml                 # Contratos e aliases usados pelo ETL
├── etl/__main__.py                 # Wrapper para `python -m etl`
├── frontend/                       # Aplicação React 18 + Vite + Tailwind
│   ├── src/features/               # Telas (painel, empresas, licenças, taxas, etc.)
│   ├── src/lib/                    # Helpers de API e formatação
│   ├── src/providers/              # Providers globais (toast, tema)
│   └── vite.config.js              # Proxy `/api` → http://localhost:8000
├── tests/                          # Pytest cobrindo API v1 e ETL
├── SCRIPTS/                        # Materiais e scripts auxiliares (certificados)
├── ATALHOS.md, FLUXO_INTEGRACOES.md# Documentação interna complementar
├── README.md                       # Visão geral da solução
├── GUIA_SETUP.md                   # Passo a passo de instalação/execução
└── ESTRUTURA_PROJETO.md            # Este mapa
```

## Referência rápida

- O `.env` do backend é compartilhado pela API, ETL e automações de CND/CAE.
- O contexto multi-tenant (`app.current_org`) é aplicado via `app.deps.auth.db_with_org` e persiste durante cada requisição.
- O ETL aceita CSVs alinhados aos contratos em `config.yaml`, grava staging (`stg_*`) e aplica UPSERT idempotente no schema principal.
