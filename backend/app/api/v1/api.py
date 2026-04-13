from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_users,
    alertas,
    auth,
    certificados,
    copilot,
    cnae_risk_official_sources,
    cnae_risk_suggestions,
    companies,
    companies_composite,
    company_licences,
    company_processes,
    company_processes_crud,
    company_profiles,
    company_taxes,
    company_taxes_patch,
    dev_receitaws_bulk_sync,
    dev_tax_portal_sync,
    grupos,
    ingest,
    lookups,
    meta,
    notifications,
    orgs,
    relatorios,
    worker,
)
from app.api.v1.endpoints.webhook_certhub import router as webhook_certhub_router


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])

api_router.include_router(companies_composite.router, prefix="/companies", tags=["companies"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])

api_router.include_router(company_profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(company_licences.router, prefix="/licencas", tags=["licencas"])

api_router.include_router(company_taxes.router, prefix="/taxas", tags=["taxas"])
api_router.include_router(company_taxes_patch.router, prefix="/taxas", tags=["taxas"])

api_router.include_router(company_processes.router, prefix="/processos", tags=["processos"])
api_router.include_router(company_processes_crud.router, prefix="/processos", tags=["processos"])

api_router.include_router(lookups.router, prefix="/lookups", tags=["lookups"])
api_router.include_router(meta.router, prefix="/meta", tags=["meta"])
api_router.include_router(grupos.router, prefix="/grupos", tags=["grupos"])
api_router.include_router(alertas.router, prefix="/alertas", tags=["alertas"])
api_router.include_router(notifications.router, prefix="/notificacoes", tags=["notificacoes"])
api_router.include_router(relatorios.router, prefix="/relatorios", tags=["relatorios"])

api_router.include_router(certificados.router, prefix="/certificados", tags=["certificados"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(cnae_risk_suggestions.router, prefix="/catalog/cnae-risk-suggestions", tags=["catalog"])
api_router.include_router(cnae_risk_official_sources.router, prefix="/catalog/cnae-risk-suggestions/official", tags=["catalog"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["admin"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
api_router.include_router(dev_receitaws_bulk_sync.router, prefix="/dev", tags=["dev"])
api_router.include_router(dev_tax_portal_sync.router, prefix="/dev", tags=["dev"])
api_router.include_router(worker.router)
api_router.include_router(webhook_certhub_router)
