from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    agendamentos,
    alertas,
    certificados,
    cnds,
    empresas,
    grupos,
    licencas,
    municipios,
    processos,
    taxas,
    uteis,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(empresas.router)
api_router.include_router(taxas.router)
api_router.include_router(licencas.router)
api_router.include_router(processos.router)
api_router.include_router(alertas.router)
api_router.include_router(grupos.router)
api_router.include_router(certificados.router)
api_router.include_router(cnds.router)
api_router.include_router(municipios.router)
api_router.include_router(uteis.router)
api_router.include_router(agendamentos.router)
