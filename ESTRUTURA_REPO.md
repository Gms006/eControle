# Estrutura do Repositorio - eControle v2

Data de referencia: 2026-03-04

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
|  |  |  |  |- admin_users.py
|  |  |  |  |- alertas.py
|  |  |  |  |- auth.py
|  |  |  |  |- certificados.py
|  |  |  |  |- companies.py
|  |  |  |  |- companies_composite.py
|  |  |  |  |- company_licences.py
|  |  |  |  |- company_processes.py
|  |  |  |  |- company_processes_crud.py
|  |  |  |  |- company_profiles.py
|  |  |  |  |- company_taxes.py
|  |  |  |  |- company_taxes_patch.py
|  |  |  |  |- dev_receitaws_bulk_sync.py
|  |  |  |  |- grupos.py
|  |  |  |  |- ingest.py
|  |  |  |  |- lookups.py
|  |  |  |  |- meta.py
|  |  |  |  |- orgs.py
|  |  |- core/
|  |  |  |- audit.py
|  |  |  |- config.py
|  |  |  |- logging.py
|  |  |  |- normalize.py
|  |  |  |- normalization.py
|  |  |  |- org_context.py
|  |  |  |- seed.py
|  |  |  |- security.py
|  |  |- db/
|  |  |  |- base.py
|  |  |  |- session.py
|  |  |- models/
|  |  |  |- company.py
|  |  |  |- company_licence.py
|  |  |  |- company_process.py
|  |  |  |- company_profile.py
|  |  |  |- company_tax.py
|  |  |  |- ingest_run.py
|  |  |  |- org.py
|  |  |  |- refresh_token.py
|  |  |  |- receitaws_bulk_sync_run.py
|  |  |  |- role.py
|  |  |  |- user.py
|  |  |- schemas/
|  |  |  |- admin_users.py
|  |  |  |- auth.py
|  |  |  |- company.py
|  |  |  |- company_composite.py
|  |  |  |- company_licence.py
|  |  |  |- company_process.py
|  |  |  |- company_profile.py
|  |  |  |- company_tax.py
|  |  |  |- org.py
|  |  |  |- token.py
|  |  |  |- user.py
|  |  |  |- receitaws_bulk_sync.py
|  |  |  |- ingest/
|  |  |     |- common.py
|  |  |     |- companies.py
|  |  |     |- envelopes.py
|  |  |     |- licences.py
|  |  |     |- processes.py
|  |  |     |- taxes.py
|  |  |- services/
|  |  |  |- receitaws_bulk_sync.py
|  |  |  |- ingest/
|  |  |     |- companies.py
|  |  |     |- company_profiles.py
|  |  |     |- licences.py
|  |  |     |- processes.py
|  |  |     |- run.py
|  |  |     |- taxes.py
|  |  |     |- utils.py
|  |- alembic/versions/
|  |  |- 20260218_0001_create_orgs.py
|  |  |- 20260218_0002_auth_tables.py
|  |  |- 20260218_0003_orgs_slug_updated_at.py
|  |  |- 20260219_0004_create_companies.py
|  |  |- 20260224_0005_create_ingest_runs.py
|  |  |- 20260224_0006_create_company_profiles.py
|  |  |- 20260224_0007_create_licences_taxes_processes.py
|  |  |- 20260226_0008_add_obs_history_company_processes.py
|  |  |- 20260227_0009_add_cnaes_to_company_profiles.py
|  |  |- 20260227_0010_normalize_municipios_existing_data.py
|  |  |- 20260227_0011_normalize_process_situacao_canonical.py
|  |  |- 20260227_0012_normalize_all_status_fields_canonical.py
|  |  |- 20260227_0013_refine_municipios_preserve_accents.py
|  |  |- 20260303_0014_add_nao_exigido_metadata_company_licences.py
|  |  |- 20260303_0015_create_receitaws_bulk_sync_runs.py
|  |- tests/
|  |  |- conftest.py
|  |  |- test_alertas_tendencia.py
|  |  |- test_auth_login_me.py
|  |  |- test_auth_rbac.py
|  |  |- test_auth_refresh_logout.py
|  |  |- test_companies_composite.py
|  |  |- test_companies_crud.py
|  |  |- test_company_licences_endpoint.py
|  |  |- test_company_taxes_patch.py
|  |  |- test_extra_endpoints.py
|  |  |- test_health.py
|  |  |- test_ingest_s7.py
|  |  |- test_ingest_s7_full.py
|  |  |- test_normalization_helpers.py
|  |  |- test_org_context.py
|  |  |- test_processes_canonical.py
|  |  |- test_receitaws_bulk_sync.py
|  |- main.py
|  |- pytest.ini
|  |- alembic.ini
|- frontend/
|  |- src/
|  |  |- api/client.ts
|  |  |- hooks/useAuth.tsx
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
|  |  |- components/
|  |  |- lib/
|  |  |- providers/
|  |  |- services/
|  |  |  |- receitawsBulkSync.js
|  |- tests_e2e/portal/
|  |  |- login_empresas.smoke.spec.ts
|  |  |- company_import_save.smoke.spec.ts
|  |  |- regression_drawers.spec.ts
|  |  |- taxas_envio_methods.smoke.spec.ts
|  |- package.json
|  |- vite.config.ts
|  |- playwright.config.ts
|- infra/
|  |- docker-compose.yml
|- scripts/
|  |- s7_validate_ingest.ps1
|  |- e2e_run_full.ps1
|  |- datasets/
|     |- companies_json_creator.py
|     |- licences_json_creator.py
|     |- processes_json_creator.py
|     |- taxes_json_creator.py
|     |- *_ingest_model.json
|- tests_e2e/api/
|  |- test_api_ingest_e2e.py
|- docs/
|  |- BASELINE_V1.md
|  |- INTEGRATION_CONTRACTS.md
|  |- REUSE_FRONTEND_MAP.md
|  |- RISKS_AND_DECISIONS_S0.md
|  |- S6_FRONTEND_REAPROVEITADO.md
|  |- S6_INDEX.md
|  |- S6_PATCHES_E_CHECKLIST.md
|  |- S6_RESUMO_EXECUTIVO.md
|  |- ingest_jsons/
|     |- empresas_v2.json
|     |- licencas_v2.json
|     |- processos_v2.json
|     |- taxas_v2.json
|- .env.example
|- requirements.txt
|- README.md
|- PLANO_DESENVOLVIMENTO.md
|- ESTRUTURA_REPO.md
|- pytest.ini
|- patch.diff
```

## Organizacao por responsabilidade

- `backend/app/api/v1/endpoints`: camada HTTP (rotas, RBAC, validacao de request/response).
- `backend/app/services/ingest`: regras de ingest/upsert e idempotencia.
- `backend/app/services/receitaws_bulk_sync.py`: job DEV-only de atualizacao em lote ReceitaWS com dry-run/only-missing/progresso/rate-limit.
- `backend/app/models`: ORM SQLAlchemy.
- `backend/app/schemas`: contratos Pydantic.
- `backend/alembic/versions`: historico de schema e migracoes de dados.
- `frontend/src/pages`: telas do portal.
- `frontend/src/components`: componentes de UI e formulario.
- `tests_e2e/api` e `frontend/tests_e2e/portal`: suites E2E.

## Observacoes importantes do estado atual

- Certificados (`backend/app/api/v1/endpoints/certificados.py`) ainda esta em modo placeholder e retorna lista vazia.
- Bulk ReceitaWS DEV-only implementado:
  - `POST /api/v1/dev/receitaws/bulk-sync/start`
  - `GET /api/v1/dev/receitaws/bulk-sync/active`
  - `GET /api/v1/dev/receitaws/bulk-sync/{run_id}`
  - `POST /api/v1/dev/receitaws/bulk-sync/{run_id}/cancel`
  - Tabela de runs: `receitaws_bulk_sync_runs`
  - UI com janela de progresso minimizavel e retomada de run ativo.
- Existem arquivos temporarios SQL/TXT em `backend/` (`tmp_*.sql`, `tmp_*.txt`) usados em investigacoes/migracoes.
- `scripts/.e2e-logs/` eh diretoria auxiliar gerada nos fluxos E2E.
