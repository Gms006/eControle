from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    alertas,
    empresas,
    grupos,
    licencas,
    processos,
    taxas,
    uteis,
)

api_router = APIRouter()
api_router.include_router(empresas.router)
api_router.include_router(licencas.router)
api_router.include_router(taxas.router)
api_router.include_router(processos.router)
api_router.include_router(alertas.router)
api_router.include_router(grupos.router)
api_router.include_router(uteis.router)
