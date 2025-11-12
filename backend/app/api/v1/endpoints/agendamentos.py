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
from app.schemas.agendamentos import AgendamentoListResponse

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])

ALLOWED_SORTS: Dict[str, str] = {
    "inicio": "inicio",
    "titulo": "titulo",
    "tipo": "tipo",
    "situacao": "situacao",
}


@router.get("", response_model=AgendamentoListResponse)
def listar_agendamentos(
    empresa_id: int | None = Query(None, description="Filtrar por empresa"),
    tipo: str | None = Query(None),
    situacao: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: str | None = Query(None, description="Campo de ordenação"),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> AgendamentoListResponse:
    page, size = ensure_positive_pagination(page, size)

    params: Dict[str, object] = {}
    filters: list[str] = [
        "(current_setting('app.current_org', true) IS NULL OR a.org_id = current_setting('app.current_org')::uuid)"
    ]

    if empresa_id is not None:
        params["empresa_id"] = empresa_id
        filters.append("a.empresa_id = :empresa_id")
    if tipo:
        params["tipo"] = tipo
        filters.append("a.tipo = :tipo")
    if situacao:
        params["situacao"] = situacao
        filters.append("a.situacao = :situacao")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT a.* FROM agendamentos a{where_clause}"

    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "inicio")
    if sort is None:
        direction = "DESC"

    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return AgendamentoListResponse(**data)
