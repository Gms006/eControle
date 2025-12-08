from __future__ import annotations

from typing import Dict

import hashlib

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import (
    build_where_clause,
    ensure_positive_pagination,
    paginate_query,
    resolve_sort,
)
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.alertas import AlertaListResponse, AlertaTrendResponse

router = APIRouter(prefix="/alertas", tags=["Alertas"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "tipo_alerta": "tipo_alerta",
    "validade": "validade",
    "dias_restantes": "dias_restantes",
}


@router.get("", response_model=AlertaListResponse)
def listar_alertas(
    tipo_alerta: str | None = Query(None),
    empresa_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(2000, ge=1, le=2000),
    sort: str | None = Query(None),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> AlertaListResponse:
    page, size = ensure_positive_pagination(page, size)
    params: Dict[str, object] = {}
    filters: list[str] = []

    if tipo_alerta:
        params["tipo_alerta"] = tipo_alerta
        filters.append("tipo_alerta = :tipo_alerta")
    if empresa_id is not None:
        params["empresa_id"] = empresa_id
        filters.append("empresa_id = :empresa_id")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_alertas_vencendo_30d{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "dias_restantes")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)

    items = []
    for row in data["items"]:
        key = (
            f"{row.get('org_id')}|{row.get('empresa_id')}|{row.get('tipo_alerta')}|"
            f"{row.get('validade')}|{row.get('descricao')}"
        )
        alerta_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
        items.append({**row, "alerta_id": alerta_id})
    data["items"] = items

    return AlertaListResponse(**data)


@router.get("/tendencia", response_model=AlertaTrendResponse)
def tendencia_alertas(
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> AlertaTrendResponse:
    """Retorna a evolução mensal de alertas de licenças vencendo ou vencidas."""

    sql = text(
        """
        SELECT
            date_trunc('month', validade)::date AS mes,
            count(*) FILTER (WHERE validade >= CURRENT_DATE) AS alertas_vencendo,
            count(*) FILTER (WHERE validade < CURRENT_DATE) AS alertas_vencidas
        FROM licencas
        WHERE validade IS NOT NULL
          AND date_trunc('month', validade) >= date_trunc('month', CURRENT_DATE) - interval '11 months'
          AND (current_setting('app.current_org', true) IS NULL OR org_id = (current_setting('app.current_org'))::uuid)
        GROUP BY mes
        ORDER BY mes
        """
    )

    rows = db.execute(sql).mappings().all()
    items = [
        {
            "mes": row["mes"],
            "alertas_vencendo": int(row.get("alertas_vencendo", 0) or 0),
            "alertas_vencidas": int(row.get("alertas_vencidas", 0) or 0),
            "total_alertas": int(row.get("alertas_vencendo", 0) or 0)
            + int(row.get("alertas_vencidas", 0) or 0),
        }
        for row in rows
    ]

    return AlertaTrendResponse(items=items)
