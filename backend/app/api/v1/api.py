from fastapi import APIRouter

from app.api.v1.endpoints import admin_users, auth, companies, orgs
from app.api.v1.endpoints import ingest, company_profiles, company_licences, company_taxes, company_processes, certificados

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(company_profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(company_licences.router, prefix="/licencas", tags=["licencas"])
api_router.include_router(company_taxes.router, prefix="/taxas", tags=["taxas"])
api_router.include_router(company_processes.router, prefix="/processos", tags=["processos"])
api_router.include_router(certificados.router, prefix="/certificados", tags=["certificados"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["admin"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
