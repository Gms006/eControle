# REUSE FRONTEND MAP (v1 -> v2)

**Objetivo**
Reaproveitar o maximo do frontend v1, mudando apenas o necessario para auth/RBAC, baseURL, e as abas Certificados e Uteis.

**Mapa de reuso (paths reais)**

| Path | Decisao | Observacoes |
| --- | --- | --- |
| `eControle_v1/frontend/src/App.jsx` | Mudar minimo | Ajustar bootstrap de dados, auth real (sem `VITE_DEV_TOKEN`), endpoints novos de certificados/uteis e comportamento das abas integradas. |
| `eControle_v1/frontend/src/main.jsx` | Reusar como esta | Mantem bootstrap do React. |
| `eControle_v1/frontend/src/index.css` | Reusar como esta | Mantem tema e tokens do v1. |
| `eControle_v1/frontend/src/providers/ToastProvider.jsx` | Reusar como esta | Toasts do v1. |
| `eControle_v1/frontend/src/components/HeaderMenuPro.jsx` | Reusar como esta | Menu, filtros globais, atalhos de teclado. |
| `eControle_v1/frontend/src/components/*` | Reusar como esta | `Chip.jsx`, `InlineBadge.jsx`, `KPI.jsx`, `CopyableIdentifier.jsx`, `StatusBadge.jsx`, `ResumoTipoCard.jsx`. |
| `eControle_v1/frontend/src/components/ui/*` | Reusar como esta | Todos os primitivos UI. |
| `eControle_v1/frontend/src/features/painel/PainelScreen.jsx` | Reusar como esta | KPIs + tendencia + listas. |
| `eControle_v1/frontend/src/features/empresas/EmpresasScreen.jsx` | Reusar como esta | Card/lista, acoes rapidas, filtros e view mode. |
| `eControle_v1/frontend/src/features/licencas/LicencasScreen.jsx` | Reusar como esta | Lista e filtros. |
| `eControle_v1/frontend/src/features/taxas/TaxasScreen.jsx` | Reusar como esta | Modos por empresa/tipo, ordenacoes. |
| `eControle_v1/frontend/src/features/processos/ProcessosScreen.jsx` | Reusar como esta | Lista, filtros, badges. |
| `eControle_v1/frontend/src/features/certificados/*` | Mudar minimo | Substituir layout por cards estilo CertHub e remover operacoes locais. |
| `eControle_v1/frontend/src/features/uteis/UteisScreen.jsx` | Mudar minimo | Trocar fonte de dados para exports do Scribere + viewer. |
| `eControle_v1/frontend/src/lib/api.js` | Mudar minimo | BaseURL/proxy novo, auth real (JWT/HttpOnly), endpoints v2. |
| `eControle_v1/frontend/src/lib/constants.js` | Reusar como esta | Atalhos e chaves. |
| `eControle_v1/frontend/src/lib/status.js` | Reusar como esta | Normalizacao de status. |
| `eControle_v1/frontend/src/lib/certificados.js` | Mudar minimo | Ajustar situacoes para mirror (read-only). |
| `eControle_v1/frontend/src/lib/process.js` | Reusar como esta | Normalizacao de processos. |
| `eControle_v1/frontend/src/lib/text.js` | Reusar como esta | Normalizacao de texto. |
| `eControle_v1/frontend/src/services/*` | Reusar como esta | `alertas.js`, `empresas.js`, `kpis.js`. |

**Mudancas minimas necessarias no v2**
- Porta do frontend: 5174 (ajustar `vite.config.js` e/ou `.env`).
- BaseURL/proxy: apontar para o backend v2 (sem conflitar com CertHub).
- Auth flow: substituir token dev por login real (cookies ou JWT seguro) no padrao CertHub.
- Aba Certificados: usar cards em modo espelho (read-only) e botao "Instalar" redirecionando para CertHub.
- Aba Uteis: listar exports do Scribere + viewer simples e botao "Abrir Scribere".
