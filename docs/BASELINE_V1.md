# BASELINE V1 (ponto alvo de paridade)

**Escopo geral**
Aplicacao single-page com abas (Tabs) internas; nao ha react-router no v1. A tela base e `eControle_v1/frontend/src/App.jsx`, com menu e filtros globais em `eControle_v1/frontend/src/components/HeaderMenuPro.jsx`.

**Rotas do frontend (abas)**
- `painel` -> `eControle_v1/frontend/src/features/painel/PainelScreen.jsx`
- `empresas` -> `eControle_v1/frontend/src/features/empresas/EmpresasScreen.jsx`
- `certificados` -> `eControle_v1/frontend/src/features/certificados/CertificadosScreen.jsx`
- `licencas` -> `eControle_v1/frontend/src/features/licencas/LicencasScreen.jsx`
- `taxas` -> `eControle_v1/frontend/src/features/taxas/TaxasScreen.jsx`
- `processos` -> `eControle_v1/frontend/src/features/processos/ProcessosScreen.jsx`
- `uteis` -> `eControle_v1/frontend/src/features/uteis/UteisScreen.jsx`

**Componentes/Features por dominio**
Empresas
- Tela principal e cards com modo compacto/detalhado, badges e acoes rapidas em `eControle_v1/frontend/src/features/empresas/EmpresasScreen.jsx`.
- Copia de identificadores e contatos com `eControle_v1/frontend/src/components/CopyableIdentifier.jsx` e `eControle_v1/frontend/src/components/InlineBadge.jsx`.
- Acoes de links externos (CNPJ/CND/CAE) via `eControle_v1/frontend/src/lib/quickLinks.ts`.
- Consumo de CND/CAE via chamadas diretas: `/api/cnds/{cnpj}/list`, `/api/cnds/emitir`, `/api/cae/emitir` (ver `eControle_v1/frontend/src/features/empresas/EmpresasScreen.jsx`).
- API v1: `GET /api/v1/empresas`, `POST /api/v1/empresas`, `PATCH /api/v1/empresas/{id}` em `eControle_v1/backend/app/api/v1/endpoints/empresas.py`.

Licencas
- Tela de listagem, filtros e badges em `eControle_v1/frontend/src/features/licencas/LicencasScreen.jsx`.
- Normalizacao de status/dias restantes em `eControle_v1/frontend/src/lib/api.js` e `eControle_v1/frontend/src/lib/status.js`.
- API v1: `GET /api/v1/licencas` em `eControle_v1/backend/app/api/v1/endpoints/licencas.py`.

Taxas
- Tela com modos "Por empresa" e "Por tipo", foco em alertas e ordenacoes por coluna em `eControle_v1/frontend/src/features/taxas/TaxasScreen.jsx`.
- Mapeamento e agregacao de taxas no client em `eControle_v1/frontend/src/lib/api.js` (normalizeTaxasFromApi).
- API v1: `GET /api/v1/taxas` em `eControle_v1/backend/app/api/v1/endpoints/taxas.py`.

Processos
- Tela com filtros globais, modo foco, badges de status e agrupamento por tipo/municipio em `eControle_v1/frontend/src/features/processos/ProcessosScreen.jsx`.
- Normalizacao de tipo/status em `eControle_v1/frontend/src/lib/process.js` e `eControle_v1/frontend/src/lib/status.js`.
- API v1: `GET /api/v1/processos` em `eControle_v1/backend/app/api/v1/endpoints/processos.py`.

Certificados
- Sub-aba "Certificados" com cards e ordenacao + sub-aba "Agendamentos" com tabela em `eControle_v1/frontend/src/features/certificados/CertificadosScreen.jsx`.
- Card de certificado em `eControle_v1/frontend/src/features/certificados/CertificadoCard.jsx`.
- Tabela de agendamentos em `eControle_v1/frontend/src/features/certificados/AgendamentosTable.jsx`.
- API v1: `GET /api/v1/certificados` e `GET /api/v1/agendamentos` em `eControle_v1/backend/app/api/v1/endpoints/certificados.py` e `eControle_v1/backend/app/api/v1/endpoints/agendamentos.py`.

Uteis
- Listas "Contatos uteis" e "Modelos de mensagem" com filtros locais em `eControle_v1/frontend/src/features/uteis/UteisScreen.jsx`.
- API v1: `GET /api/v1/uteis` em `eControle_v1/backend/app/api/v1/endpoints/uteis.py`.

Alertas e KPIs
- KPIs e tendencia de alertas no painel em `eControle_v1/frontend/src/features/painel/PainelScreen.jsx`.
- Tendencia de alertas via `eControle_v1/frontend/src/services/alertas.js` -> `GET /api/v1/alertas/tendencia`.
- KPIs via `GET /api/v1/grupos/kpis` em `eControle_v1/backend/app/api/v1/endpoints/grupos.py`.

Worker status
- Health e status de job em `eControle_v1/backend/app/api/v1/endpoints/worker.py` (`GET /api/v1/worker/health`, `GET /api/v1/worker/jobs/{job_id}`).
- Nao ha tela explicita no frontend para worker (somente backend no v1).

**Fluxos criticos**
- Auth atual: sem tela de login. Token vem de `localStorage.jwt` ou `VITE_DEV_TOKEN` em `eControle_v1/frontend/src/lib/api.js`.
- Base URL atual: `VITE_API_BASE_URL` com fallback `http://localhost:8000` em `eControle_v1/frontend/src/lib/api.js` e `eControle_v1/frontend/.env.local`.
- Bootstrap de dados: carregamento paralelo em `eControle_v1/frontend/src/App.jsx` com `fetchJson` para `/empresas`, `/licencas`, `/taxas`, `/processos`, `/certificados`, `/agendamentos`, `/kpis`, `/municipios`, `/uteis`.
- Filtros globais: busca com campo selecionavel, filtro por municipio, "Somente alertas" e "Modo foco" em `eControle_v1/frontend/src/components/HeaderMenuPro.jsx` e logica em `eControle_v1/frontend/src/App.jsx`.
- Paginacao: no UI e majoritariamente in-memory; `fetchJson` aceita `page/size` e anexa metadados em `eControle_v1/frontend/src/lib/api.js`, mas a listagem e filtragem principais ocorrem no client.
- Criacao/edicao: nao ha UI de CRUD no v1; backend possui `POST/PATCH` para empresas em `eControle_v1/backend/app/api/v1/endpoints/empresas.py`.

**Paridade obrigatoria**
- Mesmas abas e ordem de navegacao: `painel`, `empresas`, `certificados`, `licencas`, `taxas`, `processos`, `uteis` (ver `eControle_v1/frontend/src/components/HeaderMenuPro.jsx`).
- Carregamento inicial e normalizacao de dados (incluindo certificados/alertas/taxas) conforme `eControle_v1/frontend/src/App.jsx` e `eControle_v1/frontend/src/lib/api.js`.
- Filtros globais (busca, municipio, somente alertas, modo foco) e atalhos de teclado (Alt+1..7, Alt+Seta para cima, Ctrl/Cmd+K) em `eControle_v1/frontend/src/components/HeaderMenuPro.jsx` e `eControle_v1/frontend/src/lib/constants.js`.
- Painel com KPIs + tendencia de alertas + listas de pendencias, conforme `eControle_v1/frontend/src/features/painel/PainelScreen.jsx`.
- Telas de listagem por dominio com comportamento atual de filtros e ordenacao.

**Nice-to-have**
- Acoes rapidas decorativas do header (`+ Novo`, notificacoes, favoritos) em `eControle_v1/frontend/src/components/HeaderMenuPro.jsx`.
- Auto-teste do painel e mensagens de debug (console) em `eControle_v1/frontend/src/features/painel/PainelScreen.jsx`.
- Alternancia de view mode (compacto/detalhado) em `eControle_v1/frontend/src/features/empresas/EmpresasScreen.jsx`.
