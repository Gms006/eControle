from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import (
    build_where_clause,
    ensure_positive_pagination,
    paginate_query,
    resolve_sort,
)
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.grupos import GrupoKPIListResponse

router = APIRouter(prefix="/grupos", tags=["Grupos"])

ALLOWED_SORTS: Dict[str, str] = {
    "grupo": "grupo",
    "chave": "chave",
    "valor": "valor",
}


@router.get("/kpis", response_model=GrupoKPIListResponse)
def listar_kpis(
    grupo: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    sort: str | None = Query(None),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> GrupoKPIListResponse:
    page, size = ensure_positive_pagination(page, size, max_size=500)
    params: Dict[str, object] = {}
    filters: list[str] = []

    if grupo:
        params["grupo"] = grupo
        filters.append("grupo = :grupo")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_grupos_kpis{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "grupo")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return GrupoKPIListResponse(**data)
