# Estrutura do Repositorio - eControle v2

Data de referencia: 2026-04-08

## Visao geral

Monorepo com backend FastAPI, frontend React/Vite, infraestrutura Docker e suites de teste (backend + E2E API + E2E portal).

## Tree atual (resumida e fiel ao estado real)

```text
eControle/
|- backend/
|  |- app/
|  |  |- api/v1/
|  |  |  |- api.py
|  |  |  |- endpoints/
|  |  |  |  |- admin\_users.py
|  |  |  |  |- alertas.py
|  |  |  |  |- auth.py
|  |  |  |  |- certificados.py
|  |  |  |  |- copilot.py
|  |  |  |  |- cnae\_risk\_official\_sources.py
|  |  |  |  |- cnae\_risk\_suggestions.py
|  |  |  |  |- companies.py
|  |  |  |  |- companies\_composite.py
|  |  |  |  |- company\_licences.py
|  |  |  |  |- company\_processes.py
|  |  |  |  |- company\_processes\_crud.py
|  |  |  |  |- company\_profiles.py
|  |  |  |  |- company\_taxes.py
|  |  |  |  |- company\_taxes\_patch.py
|  |  |  |  |- dev\_tax\_portal\_sync.py
|  |  |  |  |- dev\_receitaws\_bulk\_sync.py
|  |  |  |  |- grupos.py
|  |  |  |  |- ingest.py
|  |  |  |  |- lookups.py
|  |  |  |  |- meta.py
|  |  |  |  |- notifications.py
|  |  |  |  |- orgs.py
|  |  |  |  |- worker.py
|  |  |  |  |- webhook\_certhub.py
|  |  |- core/
|  |  |  |- audit.py
|  |  |  |- cnae.py
|  |  |  |- config.py
|  |  |  |- logging.py
|  |  |  |- normalize.py
|  |  |  |- normalization.py
|  |  |  |- org\_context.py
|  |  |  |- seed.py
|  |  |  |- security.py
|  |  |- db/
|  |  |  |- base.py
|  |  |  |- session.py
|  |  |- models/
|  |  |  |- cnae\_risk.py
|  |  |  |- cnae\_risk\_suggestion.py
|  |  |  |- certificate\_mirror.py
|  |  |  |- company.py
|  |  |  |- company\_licence.py
|  |  |  |- licence\_scan\_run.py
|  |  |  |- licence\_file\_event.py
|  |  |  |- notification\_event.py
|  |  |  |- notification\_operational\_scan\_run.py
|  |  |  |- company\_process.py
|  |  |  |- company\_profile.py
|  |  |  |- company\_tax.py
|  |  |  |- copilot.py
|  |  |  |- ingest\_run.py
|  |  |  |- org.py
|  |  |  |- refresh\_token.py
|  |  |  |- receitaws\_bulk\_sync\_run.py
|  |  |  |- tax\_portal\_sync\_run.py
|  |  |  |- role.py
|  |  |  |- user.py
|  |  |- schemas/
|  |  |  |- admin\_users.py
|  |  |  |- auth.py
|  |  |  |- certificate.py
|  |  |  |- company.py
|  |  |  |- company\_composite.py
|  |  |  |- company\_licence.py
|  |  |  |- company\_process.py
|  |  |  |- company\_profile.py
|  |  |  |- company\_tax.py
|  |  |  |- cnae\_risk\_suggestion.py
|  |  |  |- copilot.py
|  |  |  |- official\_sources.py
|  |  |  |- org.py
|  |  |  |- notification.py
|  |  |  |- token.py
|  |  |  |- user.py
|  |  |  |- worker.py
|  |  |  |- receitaws\_bulk\_sync.py
|  |  |  |- tax\_portal\_sync.py
|  |  |  |- ingest/
|  |  |     |- common.py
|  |  |     |- companies.py
|  |  |     |- envelopes.py
|  |  |     |- licences.py
|  |  |     |- processes.py
|  |  |     |- taxes.py
|  |  |- services/
|  |  |  |- certificados\_mirror.py
|  |  |  |- certhub\_client.py
|  |  |  |- company\_scoring.py
|  |  |  |- cnae\_official\_suggestions.py
|  |  |  |- cnae\_risk\_suggestions.py
|  |  |  |- copilot.py
|  |  |  |- copilot\_document\_analysis.py
|  |  |  |- copilot\_domain\_qa.py
|  |  |  |- copilot\_provider.py
|  |  |  |- copilot\_simulation.py
|  |  |  |- official\_sources/
|  |  |  |  |- \_\_init\_\_.py
|  |  |  |  |- anapolis.py
|  |  |  |  |- anvisa.py
|  |  |  |  |- cgsim.py
|  |  |  |  |- goiania.py
|  |  |  |  |- cbmgo.py
|  |  |  |- licence\_detection.py
|  |  |  |- licence\_fs\_paths.py
|  |  |  |- licence\_files.py
|  |  |  |- licence\_scan\_full.py
|  |  |  |- notifications.py
|  |  |  |- notification\_operational\_scan.py
|  |  |  |- receitaws\_bulk\_sync.py
|  |  |  |- tax\_portal\_runtime.py
|  |  |  |- tax\_portal\_sync.py
|  |  |  |- ingest/
|  |  |     |- companies.py
|  |  |     |- company\_profiles.py
|  |  |     |- licences.py
|  |  |     |- processes.py
|  |  |     |- run.py
|  |  |     |- taxes.py
|  |  |     |- utils.py
|  |  |- worker/
|  |  |  |- \_\_init\_\_.py
|  |  |  |- watchers.py
|  |- alembic/versions/
|  |  |- 20260218\_0001\_create\_orgs.py
|  |  |- 20260218\_0002\_auth\_tables.py
|  |  |- 20260218\_0003\_orgs\_slug\_updated\_at.py
|  |  |- 20260219\_0004\_create\_companies.py
|  |  |- 20260224\_0005\_create\_ingest\_runs.py
|  |  |- 20260224\_0006\_create\_company\_profiles.py
|  |  |- 20260224\_0007\_create\_licences\_taxes\_processes.py
|  |  |- 20260226\_0008\_add\_obs\_history\_company\_processes.py
|  |  |- 20260227\_0009\_add\_cnaes\_to\_company\_profiles.py
|  |  |- 20260227\_0010\_normalize\_municipios\_existing\_data.py
|  |  |- 20260227\_0011\_normalize\_process\_situacao\_canonical.py
|  |  |- 20260227\_0012\_normalize\_all\_status\_fields\_canonical.py
|  |  |- 20260227\_0013\_refine\_municipios\_preserve\_accents.py
|  |  |- 20260303\_0014\_add\_nao\_exigido\_metadata\_company\_licences.py
|  |  |- 20260303\_0015\_create\_receitaws\_bulk\_sync\_runs.py
|  |  |- 20260304\_0016\_create\_certificate\_mirror.py
|  |  |- 20260306\_0017\_add\_fs\_dirname\_and\_licence\_file\_events.py
|  |  |- 20260311\_0018\_licences\_valid\_until\_and\_scan\_runs.py
|  |  |- 20260311\_0019\_allow\_unregistered\_company\_on\_diversos.py
|  |  |- 20260313\_0020\_create\_cnae\_risks\_and\_profile\_scores.py
|  |  |- 20260320\_0021\_create\_cnae\_risk\_suggestions.py
|  |  |- 20260325\_0022\_create\_tax\_portal\_sync\_runs.py
|  |  |- 20260327\_0023\_normalize\_municipio\_lower\_ascii.py
|  |  |- 20260327\_0024\_add\_cpf\_to\_companies.py
|  |  |- 20260401\_0025\_drop\_unused\_company\_profile\_columns.py
|  |  |- 20260402\_0026\_create\_notification\_events.py
|  |  |- 20260402\_0027\_create\_notification\_operational\_scan\_runs.py
|  |- scripts/
|  |  |- backfill\_company\_scores.py
|  |  |- load\_cnae\_risks\_seed.py
|  |  |- rfb\_agent.py
|  |  |- run\_tax\_portal\_sync\_once.py
|  |- seeds/
|  |  |- cnae\_risks.seed.csv
|  |- tests/
|  |  |- conftest.py
|  |  |- test\_alertas\_tendencia.py
|  |  |- test\_auth\_login\_me.py
|  |  |- test\_auth\_rbac.py
|  |  |- test\_auth\_refresh\_logout.py
|  |  |- test\_companies\_composite.py
|  |  |- test\_companies\_crud.py
|  |  |- test\_company\_licences\_endpoint.py
|  |  |- test\_company\_taxes\_patch.py
|  |  |- test\_copilot\_endpoints.py
|  |  |- test\_copilot\_provider.py
|  |  |- test\_company\_scoring.py
|  |  |- test\_cnae\_official\_sources.py
|  |  |- test\_cnae\_risk\_suggestions.py
|  |  |- test\_extra\_endpoints.py
|  |  |- test\_health.py
|  |  |- test\_ingest\_s7.py
|  |  |- test\_ingest\_s7\_full.py
|  |  |- test\_licence\_watcher.py
|  |  |- test\_licence\_fs\_paths.py
|  |  |- test\_licencas\_detect.py
|  |  |- test\_licencas\_upload\_bulk.py
|  |  |- test\_licence\_migration\_backfill.py
|  |  |- test\_lookups\_receitaws.py
|  |  |- test\_normalization\_helpers.py
|  |  |- test\_org\_context.py
|  |  |- test\_processes\_canonical.py
|  |  |- test\_receitaws\_bulk\_sync.py
|  |  |- test\_tax\_portal\_sync.py
|  |  |- test\_notifications\_service.py
|  |  |- test\_notifications\_endpoints.py
|  |  |- test\_business\_days.py
|  |  |- test\_notification\_rules.py
|  |  |- test\_worker\_endpoints.py
|  |- main.py
|  |- pytest.ini
|  |- alembic.ini
|- frontend/
|  |- src/
|  |  |- api/
|  |  |  |- client.ts
|  |  |- components/
|  |  |  |- header/
|  |  |  |  |- HeaderMenuPro.jsx
|  |  |  |  |- BulkSyncManager.jsx
|  |  |  |  |- TaxPortalSyncManager.jsx
|  |  |  |- forms/
|  |  |  |  |- DrawerFormPrimitives.jsx
|  |  |  |  |- FormSideDrawer.jsx
|  |  |  |  |- CompanyDrawer.jsx
|  |  |  |  |- ProcessDrawer.jsx
|  |  |  |  |- TaxDrawer.jsx
|  |  |  |- layout/
|  |  |  |  |- PageTitle.tsx
|  |  |  |  |- Sidebar.tsx
|  |  |  |  |- Topbar.tsx
|  |  |  |- notifications/
|  |  |  |  |- NotificationPanel.jsx
|  |  |  |- copilot/
|  |  |  |  |- CopilotWidget.jsx
|  |  |  |- ui/
|  |  |  |  |- OverlayModal.jsx
|  |  |  |  |- side-drawer.jsx
|  |  |- hooks/
|  |  |  |- useAuth.tsx
|  |  |  |- useCompanyForm.js
|  |  |  |- useProcessForm.js
|  |  |  |- useTaxForm.js
|  |  |  |- useReceitaWsLookup.js
|  |  |  |- useReceitaWsBulkSync.js
|  |  |  |- useTaxPortalSync.js
|  |  |  |- useCopilotWidget.js
|  |  |- lib/
|  |  |  |- text.js
|  |  |  |- masks.js
|  |  |  |- normalization.js
|  |  |  |- date.js
|  |  |  |- installment.js
|  |  |  |- status.js
|  |  |  |- taxes.js
|  |  |  |- constants.js
|  |  |- pages/
|  |  |  |- MainApp.tsx
|  |  |  |- PainelScreen.jsx
|  |  |  |- EmpresasScreen.jsx
|  |  |  |- LicencasScreen.jsx
|  |  |  |- TaxasScreen.jsx
|  |  |  |- ProcessosScreen.jsx
|  |  |  |- CertificadosScreen.tsx
|  |  |  |- auth/
|  |  |     |- Login.tsx
|  |  |     |- ResetPassword.tsx
|  |  |     |- SetPassword.tsx
|  |  |- providers/
|  |  |- services/
|  |  |  |- notifications.js
|  |  |  |- receitawsBulkSync.js
|  |  |  |- taxPortalSync.js
|  |  |  |- copilot.js
|  |- tests\_e2e/portal/
|  |  |- company\_scoring.spec.ts
|  |  |- login\_empresas.smoke.spec.ts
|  |  |- licencas\_upload\_action.smoke.spec.ts
|  |  |- company\_import\_save.smoke.spec.ts
|  |  |- regression\_drawers.spec.ts
|  |  |- taxas\_envio\_methods.smoke.spec.ts
|  |  |- taxas\_tax\_portal\_sync.smoke.spec.ts
|  |  |- notifications\_center.smoke.spec.ts
|  |  |- copilot\_widget.smoke.spec.ts
|  |- package.json
|  |- vite.config.ts
|  |- playwright.config.ts
|- infra/
|  |- docker-compose.yml
|- scripts/
|  |- s7\_validate\_ingest.ps1
|  |- e2e\_run\_full.ps1
|  |- ops/
|  |  |- certhub\_mirror\_sync.ps1
|  |  |- run\_certhub\_mirror\_sync.cmd
|  |  |- run\_notification\_operational\_scan.ps1
|  |  |- run\_notification\_operational\_scan.cmd
|  |- datasets/
|     |- companies\_json\_creator.py
|     |- licences\_json\_creator.py
|     |- processes\_json\_creator.py
|     |- taxes\_json\_creator.py
|     |- \*\_ingest\_model.json
|- tests\_e2e/api/
|  |- test\_api\_ingest\_e2e.py
|  |- test\_notifications\_operational\_scan\_e2e.py
|- docs/
|  |- BASELINE\_V1.md
|  |- INTEGRATION\_CONTRACTS.md
|  |- REUSE\_FRONTEND\_MAP.md
|  |- RISKS\_AND\_DECISIONS\_S0.md
|  |- S6\_FRONTEND\_REAPROVEITADO.md
|  |- S6\_INDEX.md
|  |- S6\_PATCHES\_E\_CHECKLIST.md
|  |- S6\_RESUMO\_EXECUTIVO.md
|  |- ingest\_jsons/
|     |- empresas\_v2.json
|     |- licencas\_v2.json
|     |- processos\_v2.json
|     |- taxas\_v2.json
|- .env.example
|- requirements.txt
|- README.md
|- PLANO\_DESENVOLVIMENTO.md
|- ESTRUTURA\_REPO.md
|- pytest.ini
```

## Organizacao por responsabilidade

* `backend/app/api/v1/endpoints`: camada HTTP (rotas, RBAC, validacao de request/response).
* `backend/app/services/ingest`: regras de ingest/upsert e idempotencia.
* `backend/app/services/receitaws\_bulk\_sync.py`: job DEV-only de atualizacao em lote ReceitaWS com dry-run/only-missing/progresso/rate-limit.
* `backend/app/services/certificados\_mirror.py`: mirror de certificados (upsert/delete/reconcile full para integracao CertHub).
* `backend/app/models`: ORM SQLAlchemy.
* `backend/app/schemas`: contratos Pydantic.
* `backend/alembic/versions`: historico de schema e migracoes de dados.
* `frontend/src/pages`: telas do portal.
* `frontend/src/components`: componentes de UI e formulario.
* `tests\_e2e/api` e `frontend/tests\_e2e/portal`: suites E2E.

## Observacoes importantes do estado atual

* Certificados (`backend/app/api/v1/endpoints/certificados.py`) agora leem de mirror local com sync e health.
* Webhook CertHub (`backend/app/api/v1/endpoints/webhook\_certhub.py`) habilitado:

  * `POST /api/v1/integracoes/certhub/webhook`
  * auth por Bearer token fixo (`CERTHUB\_WEBHOOK\_TOKEN`)
  * modos `upsert`, `delete`, `full` com resolucao por `org\_slug`
  * `full` com guard para payload vazio (sem wipe de mirror)
* Integracao CertHub no backend suporta:

  * pull por template (`CERTHUB\_CERTS\_LIST\_URL\_TEMPLATE`)
  * header de tenant (`X-Org-Slug`)
  * TLS configuravel (`CERTHUB\_VERIFY\_TLS`/`CERTHUB\_CA\_BUNDLE`)
  * login automatico opcional (`CERTHUB\_AUTH\_LOGIN\_URL`, `CERTHUB\_EMAIL`, `CERTHUB\_PASSWORD`)
* Bulk ReceitaWS DEV-only implementado:

  * `POST /api/v1/dev/receitaws/bulk-sync/start`
  * `GET /api/v1/dev/receitaws/bulk-sync/active`
  * `GET /api/v1/dev/receitaws/bulk-sync/{run\_id}`
  * `POST /api/v1/dev/receitaws/bulk-sync/{run\_id}/cancel`
  * Tabela de runs: `receitaws\_bulk\_sync\_runs`
  * UI com janela de progresso minimizavel e retomada de run ativo.
* Worker endpoints S10.1a (read-only) concluidos:

  * `GET /api/v1/worker/health` valida DB e resume jobs/watchers suportados
  * `GET /api/v1/worker/jobs/{job\_id}` consulta status/progresso do job (`receitaws\_bulk\_sync\_runs`, `tax\_portal\_sync\_runs` e `licence\_scan\_runs`)
  * ajuste aplicado em 2026-04-02: remoção de `include_router(worker.router)` duplicado em `backend/app/api/v1/api.py`
* Notification Center MVP (S10.4) entregue em 2026-04-02:

  * tabela `notification_events` + migration `20260402_0026_create_notification_events.py`
  * serviço de emissão idempotente `backend/app/services/notifications.py`
  * endpoints `backend/app/api/v1/endpoints/notifications.py`:
    - `GET /api/v1/notificacoes`
    - `GET /api/v1/notificacoes/unread-count`
    - `POST /api/v1/notificacoes/{id}/read`
  * integração inicial de emissão no fim dos jobs:
    - `backend/app/services/licence_scan_full.py`
    - `backend/app/services/receitaws_bulk_sync.py`
    - `backend/app/services/tax_portal_sync.py`
  * frontend com sino + painel:
    - `frontend/src/components/layout/Topbar.tsx`
    - `frontend/src/components/notifications/NotificationPanel.jsx`
    - `frontend/src/services/notifications.js`
* Notification Center Fase C (S10.5) entregue em 2026-04-02:

  * utilitário de dias úteis: `backend/app/services/business_days.py`
  * scan operacional: `backend/app/services/notification_operational_scan.py`
  * endpoint manual: `POST /api/v1/notificacoes/scan-operacional` (`ADMIN|DEV`)
  * run table:
    - `notification_operational_scan_runs`
    - migration `backend/alembic/versions/20260402_0027_create_notification_operational_scan_runs.py`
  * integração no worker:
    - `jobs_supported` inclui `notification_operational_scan`
    - `/worker/jobs/{job_id}` resolve status de run operacional
  * regras automáticas:
    - `LIC_BOMBEIROS_BD5`
    - `LIC_ALVARA_D30`
    - `LIC_SANITARIO_D30`
    - `LIC_AMBIENTAL_BD30`
    - `PROC_STALE_BD7`
    - `PROC_STALE_BD15`
* Operacionalização diária do scan de notificações (S10.5b):

  * estratégia oficial: scheduler externo Windows (sem scheduler interno no FastAPI)
  * script operacional:
    - `scripts/ops/run_notification_operational_scan.ps1`
  * wrapper Task Scheduler:
    - `scripts/ops/run_notification_operational_scan.cmd`
  * o script usa endpoint já existente:
    - `POST /api/v1/notificacoes/scan-operacional`
    - `GET /api/v1/worker/jobs/{run_id}`
  * resultado operacional:
    - `exit 0` quando `completed`
    - `exit 1` em falha/cancelamento/timeout
* Copiloto eControle S11.1 (read-only) refinado em 2026-04-08:

  * endpoint backend dedicado:
    - `POST /api/v1/copilot/respond` (`ADMIN|DEV|VIEW`, multipart com `document` opcional)
  * serviço central:
    - `backend/app/services/copilot.py`
    - `backend/app/services/copilot_domain_qa.py` (categoria `DUVIDAS_DIVERSAS`)
    - abstração de provider em `backend/app/services/copilot_provider.py`
      - provider principal `gemini` (`gemini-2.5-flash`) com fallback opcional `ollama` (`gemma3:4b`)
      - tratamento controlado de timeout/auth/rate-limit/indisponibilidade
      - logs de provider tentado/usado, web search e fallback (sem vazamento de segredos)
    - pipeline documental hardened em `backend/app/services/copilot_document_analysis.py`:
      - PDF: extração de texto + tentativa de renderização de páginas
      - classificação em conjunto fechado de tipos do domínio
      - `NAO_CONCLUSIVO` quando faltar evidência
    - `DUVIDAS_DIVERSAS` com uso controlado de web search/grounding e retorno de fontes/citações quando disponíveis
  * frontend global:
    - widget flutuante em `frontend/src/components/copilot/CopilotWidget.jsx`
    - estado persistido em localStorage + fluxo guiado categoria -> (empresa quando necessário) -> input
    - indicador discreto `Resposta com busca externa` + fontes clicáveis quando houver grounding
  * cobertura:
    - backend: `backend/tests/test_copilot_endpoints.py`
    - backend unit/provider: `backend/tests/test_copilot_provider.py`
    - portal E2E: `frontend/tests_e2e/portal/copilot_widget.smoke.spec.ts`
* Tax Portal Sync (backend + frontend Subfase B concluídos em 2026-03-26):

  * endpoint DEV-only: `backend/app/api/v1/endpoints/dev_tax_portal_sync.py`
  * serviço de orquestração: `backend/app/services/tax_portal_sync.py`
  * runtime portal preservado: `backend/app/services/tax_portal_runtime.py`
  * persistência em `company_taxes` com regra `*`/`Pago`, `raw.tax_portal_sync` e recálculo de `status_taxas`
  * run table: `tax_portal_sync_runs` (`backend/alembic/versions/20260325_0022_create_tax_portal_sync_runs.py`)
  * frontend Subfase B:
    - `frontend/src/services/taxPortalSync.js`
    - `frontend/src/hooks/useTaxPortalSync.js`
    - `frontend/src/components/header/TaxPortalSyncManager.jsx`
    - integração em `frontend/src/pages/TaxasScreen.jsx`
    - smoke E2E: `frontend/tests_e2e/portal/taxas_tax_portal_sync.smoke.spec.ts`
* S10.1b (upload + watcher) concluido:

  * `POST /api/v1/licencas/upload-bulk` (ADMIN|DEV) com escrita atomica `.tmp -> rename`
  * nomes padronizados de licenca com suporte a `- Val DD.MM.AAAA` e `- Definitivo`
  * hierarquia por tipo: `Definitivo > maior validade`
  * tabela `licence\_file\_events` para dedupe/idempotencia por hash
  * `companies.fs\_dirname` para vinculo seguro empresa -> pasta
  * watcher executavel separado: `python -m app.worker.watchers`
* S10.2 (concluido):

  * `POST /api/v1/licencas/detect` (ADMIN|DEV) para sugestoes por filename
  * `backend/app/services/licence\_detection.py` centraliza parse/canonizacao/hierarquia por grupo
  * `backend/app/services/licence\_fs\_paths.py` resolve subpastas Matriz/Filial/Municipio
  * watcher aplica `Definitivo > maior validade` por grupo e preserva tipo real em `raw` (`source\_document\_kind\_\*`)
  * `frontend/src/pages/LicencasScreen.jsx` usa drawer assistido (sem `window.prompt`)
  * `POST /api/v1/licencas/scan-full` executa scan manual em lote com `BackgroundTasks`
  * tabela `licence\_scan\_runs` persiste progresso (`queued/running/done/error`)
* S10.2 (incremental fs\_dirname):

  * schema/validacao de `companies.fs\_dirname` em `backend/app/schemas/company.py` e `backend/app/schemas/company\_composite.py`
  * ingest `companies` com `fs\_dirname`/`alias` em `backend/app/schemas/ingest/companies.py` e `backend/app/services/ingest/companies.py`
  * formulario de empresa no portal em `frontend/src/components/HeaderMenuPro.jsx` com label `Apelido (Pasta)` e validacao client-side
  * datasets em `scripts/datasets/companies\_ingest\_model.json` e `scripts/datasets/companies\_json\_creator.py`
* Existem arquivos temporarios SQL/TXT em `backend/` (`tmp\_\*.sql`, `tmp\_\*.txt`) usados em investigacoes/migracoes.
* `scripts/.e2e-logs/` eh diretoria auxiliar gerada nos fluxos E2E.
* Pos-S10.2 implementado:

  * processos `DIVERSOS` aceitam empresa nao cadastrada (`company\_id` nulo com `company\_cnpj` + `company\_razao\_social`) e persistem flag em `raw`
  * frontend filtra licencas/taxas/processos/certificados para empresas ativas, preservando processos `DIVERSOS` sem cadastro
  * `GET /api/v1/lookups/receitaws/{cnpj}` usa ReceitaWS como primario e fallback automatico para BrasilAPI
  * scripts operacionais para sync do mirror CertHub em `scripts/ops/`
* S10.3 fase 2 (backend) concluida:

  * serviço central `backend/app/services/company\_scoring.py` para cálculo de score por CNAE + vencimentos
  * recálculo integrado em endpoints/services/watcher sem duplicar regra
  * recálculo otimizado no watcher e no bulk sync (somente quando há mudança real)
  * testes dedicados em `backend/tests/test\_company\_scoring.py`
  * script operacional `backend/scripts/backfill\_company\_scores.py` para popular snapshots legados
* S10.3 parcial P1 concluido:

  * helper canonico de CNAE em `backend/app/core/cnae.py`
  * normalizacao de CNAE aplicada em ingest, bulk ReceitaWS e cálculo de score
  * script `backend/scripts/load\_cnae\_risks\_seed.py` suporta recálculo no mesmo fluxo:

    * `--recalculate-affected`
    * `--recalculate-all`
* S10.3 parcial (calibragem de catalogo) em andamento:

  * `backend/seeds/cnae\_risks.seed.csv` com tiers/pesos calibrados (nao mais totalmente `LOW/10`)
  * placeholders invalidos de CNAE tratados como ausencia (`NO\_CNAE`) via `backend/app/core/cnae.py`
  * testes de score cobrindo placeholder, mistura de tiers e recálculo após atualização de catálogo
* S10.3 fase 3 (frontend + E2E portal) concluida:

  * `frontend/src/pages/EmpresasScreen.jsx` com score/risco/status, filtro por risco e ordenação por score
  * tratamento visual defensivo para valores nulos de score
  * placeholder CNAE `00.00-0-00` não é destacado como CNAE útil na exibição
  * teste E2E portal em `frontend/tests\_e2e/portal/company\_scoring.spec.ts`
* S10.3 subfase de atualização assistida (base segura) entregue:

  * tabela `cnae\_risk\_suggestions` com revisão humana obrigatória antes de aplicar em `cnae\_risks`
  * endpoint `backend/app/api/v1/endpoints/cnae\_risk\_suggestions.py` (`ADMIN|DEV`)
  * serviço `backend/app/services/cnae\_risk\_suggestions.py` com:

    * aprovação transacional (upsert em catálogo + recálculo afetados + auditoria)
    * edição somente quando `PENDING`
    * rejeição com marcação de revisão
  * testes dedicados em `backend/tests/test\_cnae\_risk\_suggestions.py`
* S10.3b entrega 2b (consulta oficial priorizada para propostas pendentes) entregue:

  * endpoint `backend/app/api/v1/endpoints/cnae\_risk\_official\_sources.py` (`ADMIN|DEV`)
  * orquestrador `backend/app/services/cnae\_official\_suggestions.py`
  * adaptadores em `backend/app/services/official\_sources/` para:

    * `ANAPOLIS` (prioritária), `CGSIM`, `ANVISA`, `GOIANIA` (fallback/referência), `CBMGO`
  * schema de findings normalizados em `backend/app/schemas/official\_sources.py`
  * criação automática de sugestões sempre em `PENDING` (sem autoapply em `cnae\_risks`)
  * `CGSIM` com integração resiliente oficial (`principal -> /view -> índice`) e rastreabilidade em modo semi-real quando houver HTTP 403
  * `CBMGO` contextual (NT 01/2025 + anexo + NT 14/2025), sem fechamento isolado de risco final por CNAE
  * tolerância a falha por fonte + deduplicação de pendências idênticas
  * testes dedicados em `backend/tests/test\_cnae\_official\_sources.py`

