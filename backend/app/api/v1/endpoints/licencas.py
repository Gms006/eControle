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
from app.schemas.licencas import LicencaCreate, LicencaListResponse, LicencaUpdate, LicencaView
from db.models_sql import Empresa, Licenca

router = APIRouter(prefix="/licencas", tags=["Licenças"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "tipo": "tipo",
    "status": "status",
    "validade": "validade",
    "dias_para_vencer": "dias_para_vencer",
}


def _fetch_licenca_view(db: Session, licenca_id: int) -> LicencaView:
    query = text("SELECT * FROM v_licencas_api WHERE licenca_id = :licenca_id")
    row = db.execute(query, {"licenca_id": licenca_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licença não encontrada")
    return LicencaView(**row)


@router.get("", response_model=LicencaListResponse)
def listar_licencas(
    empresa_id: int | None = Query(None),
    tipo: str | None = Query(None),
    status_filtro: str | None = Query(None, alias="status"),
    municipio: str | None = Query(None),
    vencer_em_dias: int | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    size: int = Query(2000, ge=1, le=2000),
    sort: str | None = Query(None),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> LicencaListResponse:
    page, size = ensure_positive_pagination(page, size)
    params: Dict[str, object] = {}
    filters: list[str] = []

    if empresa_id is not None:
        params["empresa_id"] = empresa_id
        filters.append("empresa_id = :empresa_id")
    if tipo:
        params["tipo"] = tipo
        filters.append("tipo = :tipo")
    if status_filtro:
        params["status"] = status_filtro
        filters.append("status = :status")
    if municipio:
        params["municipio"] = municipio
        filters.append("municipio = :municipio")
    if vencer_em_dias is not None:
        params["vencer_em_dias"] = vencer_em_dias
        filters.append("dias_para_vencer IS NOT NULL AND dias_para_vencer <= :vencer_em_dias")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_licencas_api{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "validade")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return LicencaListResponse(**data)


@router.post("", response_model=LicencaView, status_code=status.HTTP_201_CREATED)
def criar_licenca(
    payload: LicencaCreate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> LicencaView:
    empresa = db.get(Empresa, payload.empresa_id)
    if not empresa or str(empresa.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

    licenca = Licenca(**payload.model_dump())
    licenca.org_id = user.org_id
    licenca.created_by = user.id
    db.add(licenca)
    db.commit()
    db.refresh(licenca)
    return _fetch_licenca_view(db, licenca.id)


@router.patch("/{licenca_id}", response_model=LicencaView)
def atualizar_licenca(
    licenca_id: int,
    payload: LicencaUpdate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> LicencaView:
    licenca = db.get(Licenca, licenca_id)
    if not licenca or str(licenca.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licença não encontrada")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(licenca, field, value)
    licenca.updated_by = user.id
    db.add(licenca)
    db.commit()
    return _fetch_licenca_view(db, licenca.id)
