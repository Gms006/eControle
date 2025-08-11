from __future__ import annotations
from typing import List
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.schemas import Empresa, Licenca, Taxa, Processo, ChecklistItem
from core.services import Services

app = FastAPI(title="Maria Clara API", version="0.1.0")

# CORS dev-friendly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_services() -> Services:
    return Services(base_dir="data/exports")


# --------------------
# Overview / Métricas
# --------------------
@app.get("/metrics")
def get_metrics(svc: Services = Depends(get_services)):
    return svc.metrics_overview()


# --------------------
# Empresas (CRUD mínimo)
# --------------------
@app.get("/empresas", response_model=List[Empresa])
def list_empresas(svc: Services = Depends(get_services)):
    return svc.list_empresas()


@app.get("/empresas/{id}", response_model=Empresa)
def get_empresa(id: UUID, svc: Services = Depends(get_services)):
    e = svc.get_empresa(id)
    if not e:
        raise HTTPException(404, detail="Empresa não encontrada")
    return e


@app.post("/empresas", response_model=Empresa)
def create_empresa(payload: Empresa, svc: Services = Depends(get_services)):
    return svc.save_empresa(payload)


@app.delete("/empresas/{id}")
def delete_empresa(id: UUID, svc: Services = Depends(get_services)):
    svc.delete_empresa(id)
    return {"ok": True}


# --------------------
# Listagens básicas
# --------------------
@app.get("/licencas", response_model=List[Licenca])
def list_licencas(svc: Services = Depends(get_services)):
    return svc.list_licencas()


@app.get("/taxas", response_model=List[Taxa])
def list_taxas(svc: Services = Depends(get_services)):
    return svc.list_taxas()


@app.get("/processos", response_model=List[Processo])
def list_processos(svc: Services = Depends(get_services)):
    return svc.list_processos()


@app.get("/checklists", response_model=List[ChecklistItem])
def list_checklists(svc: Services = Depends(get_services)):
    return svc.list_checklists()


# Execução local: uvicorn api.main:app --reload
