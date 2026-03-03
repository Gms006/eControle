from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_users,
    alertas,
    auth,
    certificados,
    companies,
    companies_composite,
    company_licences,
    company_processes,
    company_processes_crud,
    company_profiles,
    company_taxes,
    company_taxes_patch,
    grupos,
    ingest,
    lookups,
    meta,
    orgs,
)


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

api_router.include_router(certificados.router, prefix="/certificados", tags=["certificados"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["admin"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
