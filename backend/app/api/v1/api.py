from fastapi import APIRouter

from app.api.v1.endpoints import admin_users, auth, companies, orgs
from app.api.v1.endpoints import ingest

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["admin"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
