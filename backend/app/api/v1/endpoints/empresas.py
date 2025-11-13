from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import (
    build_where_clause,
    ensure_positive_pagination,
    paginate_query,
    resolve_sort,
)
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.empresas import EmpresaCreate, EmpresaListResponse, EmpresaUpdate, EmpresaView
from db.models_sql import Empresa

router = APIRouter(prefix="/empresas", tags=["Empresas"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "cnpj": "cnpj",
    "municipio": "municipio",
    "updated_at": "updated_at",
    "total_licencas": "total_licencas",
    "total_taxas": "total_taxas",
    "processos_ativos": "processos_ativos",
}


def _fetch_empresa_view(db: Session, empresa_id: int) -> EmpresaView:
    query = text("SELECT * FROM v_empresas WHERE empresa_id = :empresa_id")
    row = db.execute(query, {"empresa_id": empresa_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")
    return EmpresaView(**row)


@router.get("", response_model=EmpresaListResponse)
def listar_empresas(
    q: str | None = Query(None, description="Busca por nome ou CNPJ"),
    municipio: str | None = Query(None),
    porte: str | None = Query(None),
    categoria: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=2000),
    sort: str | None = Query(None, description="Campo de ordenação"),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> EmpresaListResponse:
    page, size = ensure_positive_pagination(page, size)
    params: Dict[str, object] = {}
    filters: list[str] = []

    if q:
        params["q"] = f"%{q}%"
        filters.append("(empresa ILIKE :q OR cnpj ILIKE :q)")
    if municipio:
        params["municipio"] = municipio
        filters.append("municipio = :municipio")
    if porte:
        params["porte"] = porte
        filters.append("porte = :porte")
    if categoria:
        params["categoria"] = categoria
        filters.append("categoria = :categoria")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_empresas{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "empresa")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return EmpresaListResponse(**data)


@router.post("", response_model=EmpresaView, status_code=status.HTTP_201_CREATED)
def criar_empresa(
    payload: EmpresaCreate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> EmpresaView:
    empresa = Empresa(**payload.model_dump())
    empresa.org_id = user.org_id
    empresa.created_by = user.id
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return _fetch_empresa_view(db, empresa.id)


@router.patch("/{empresa_id}", response_model=EmpresaView)
def atualizar_empresa(
    empresa_id: int,
    payload: EmpresaUpdate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> EmpresaView:
    empresa = db.get(Empresa, empresa_id)
    if not empresa or str(empresa.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(empresa, field, value)
    empresa.updated_by = user.id
    db.add(empresa)
    db.commit()
    return _fetch_empresa_view(db, empresa.id)
