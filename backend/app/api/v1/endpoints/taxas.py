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
from app.schemas.taxas import TaxaCreate, TaxaListResponse, TaxaUpdate, TaxaView
from db.models_sql import Empresa, Taxa

router = APIRouter(prefix="/taxas", tags=["Taxas"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "tipo": "tipo",
    "status": "status",
    "data_envio": "data_envio",
    "vencimento_tpi": "vencimento_tpi",
}


def _fetch_taxa_view(db: Session, taxa_id: int) -> TaxaView:
    query = text("SELECT * FROM v_taxas_status WHERE taxa_id = :taxa_id")
    row = db.execute(query, {"taxa_id": taxa_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taxa não encontrada")
    return TaxaView(**row)


@router.get("", response_model=TaxaListResponse)
def listar_taxas(
    empresa_id: int | None = Query(None),
    tipo: str | None = Query(None),
    status_filtro: str | None = Query(None, alias="status"),
    esta_pago: bool | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: str | None = Query(None),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> TaxaListResponse:
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
    if esta_pago is not None:
        params["esta_pago"] = esta_pago
        filters.append("esta_pago = :esta_pago")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_taxas_status{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "empresa")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return TaxaListResponse(**data)


@router.post("", response_model=TaxaView, status_code=status.HTTP_201_CREATED)
def criar_taxa(
    payload: TaxaCreate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> TaxaView:
    empresa = db.get(Empresa, payload.empresa_id)
    if not empresa or str(empresa.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

    taxa = Taxa(**payload.model_dump())
    taxa.org_id = user.org_id
    taxa.created_by = user.id
    db.add(taxa)
    db.commit()
    db.refresh(taxa)
    return _fetch_taxa_view(db, taxa.id)


@router.patch("/{taxa_id}", response_model=TaxaView)
def atualizar_taxa(
    taxa_id: int,
    payload: TaxaUpdate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> TaxaView:
    taxa = db.get(Taxa, taxa_id)
    if not taxa or str(taxa.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taxa não encontrada")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(taxa, field, value)
    taxa.updated_by = user.id
    db.add(taxa)
    db.commit()
    return _fetch_taxa_view(db, taxa.id)
