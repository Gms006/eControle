# Estrutura do Repositorio - eControle v2

Data de referencia: 2026-05-04

## Visao geral

Monorepo com backend FastAPI, frontend React/Vite, infraestrutura Docker e suites de teste (backend + E2E API + E2E portal).

## Estrutura atual (resumo fiel)

```text
eControle/
|- backend/
|  |- app/
|  |  |- api/v1/endpoints/ (auth, orgs, companies, profiles, licencas, taxas, processos,
|  |  |  alertas, notificacoes, dashboard_views, relatorios, certificados, copilot, worker, ingest, lookups)
|  |  |- core/ (config, security, org_context, normalization, regulatory)
|  |  |- db/ (base, session)
|  |  |- models/ (org, user, role, companies, licences, taxes, processes, notifications,
|  |  |  certificate_mirror, dashboard_saved_view, cnae_risk, cnae_risk_suggestion, run tables)
|  |  |- schemas/ (auth, domain, worker, ingest, copilot, notifications, dashboard_saved_view)
|  |  |- services/ (ingest, scoring, notifications, tax_portal_sync, receitaws_bulk_sync,
|  |  |  certificate mirror, official_sources, copilot)
|  |  |- worker/watchers.py
|  |- alembic/versions/ (0001..0030)
|  |- scripts/ (backfill_company_scores, load_cnae_risks_seed, run_tax_portal_sync_once)
|  |- seeds/cnae_risks.seed.csv
|  |- tests/
|  |- main.py
|- frontend/
|  |- src/
|  |  |- pages/ (MainApp, PainelScreen, EmpresasScreen, LicencasScreen, TaxasScreen,
|  |  |  ProcessosScreen, CertificadosScreen, AutomacoesScreen, auth/*)
|  |  |- components/ (layout, header, forms, forms/process, notifications, navigation, companies, licencas, taxas, processos, copilot, ui)
|  |  |- hooks/ (auth, forms, tax portal sync, ReceitaWS, copilot, company overview, companies, licencas, taxas, processos)
|  |  |- services/ (empresas, alertas, notifications, relatorios, copilot,
|  |  |  dashboardViews, taxPortalSync, receitawsBulkSync)
|  |  |- lib/ (api, theme, navigation, normalization, status, certificados, utilitarios,
|  |  |  format/*, domain/adapters incl. mainAppView/asyncCollections, domain/indexes, domain/status/*, auth)
|  |- tests_e2e/portal/
|  |- public/ (logos e favicons)
|  |- package.json
|- docs/ (baseline, contratos, mapa de reuso, patches/checklists S6, ingest_jsons)
|- infra/docker-compose.yml
|- scripts/
|  |- ops/ (scan operacional notificacoes, mirror CertHub)
|  |- datasets/ (geradores de JSON de ingest)
|  |- s7_validate_ingest.ps1
|  |- e2e_run_full.ps1
|- tests_e2e/api/
|- README.md
|- PLANO_DESENVOLVIMENTO.md
|- requirements.txt
```

## Observacoes de manutencao

- Este documento e um resumo estrutural: manter nomes de modulos e dominios sincronizados com `backend/app` e `frontend/src`.
- Em caso de novas migrations/endpoints, atualizar este arquivo junto do `README.md` e `PLANO_DESENVOLVIMENTO.md`.
- A tela `AutomacoesScreen` depende de `GET /api/v1/worker/snapshot` e `GET /api/v1/worker/health`.
- No frontend, `lib/navigation.js` e a fonte canonica da navegacao principal/subnav; `lib/theme.ts` permanece como camada tipada de compatibilidade.
- No frontend, `lib/status.js` permanece como fachada compatível, enquanto os mapas/resolvers puros foram fatiados em `lib/domain/status/*`.
- No frontend, formatadores/normalizadores compartilhados ficam em `lib/format/*`, com reexports legados temporarios em `lib/text.js`, `lib/date.js`, `lib/normalization.js` e `lib/masks.js`.
