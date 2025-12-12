from __future__ import annotations

import os
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import (
    build_where_clause,
    ensure_positive_pagination,
    paginate_query,
    resolve_sort,
)
from app.db.session import SessionLocal
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.certificados import CertificadoListResponse
from app.services.certificados_ingest import ingest_certificados

router = APIRouter(prefix="/certificados", tags=["Certificados"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "cnpj": "cnpj",
    "valido_de": "valido_de",
    "valido_ate": "valido_ate",
    "dias_restantes": "dias_restantes",
}


@router.get("", response_model=CertificadoListResponse)
def listar_certificados(
    q: str | None = Query(None, description="Busca por empresa ou CNPJ"),
    page: int = Query(1, ge=1),
    size: int = Query(2000, ge=1, le=2000),
    sort: str | None = Query(None, description="Campo de ordenação"),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> CertificadoListResponse:
    page, size = ensure_positive_pagination(page, size)

    params: Dict[str, object] = {}
    filters: list[str] = []

    if q:
        params["q"] = f"%{q}%"
        filters.append("(empresa ILIKE :q OR cnpj ILIKE :q)")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_certificados_status{where_clause}"

    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "valido_ate")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return CertificadoListResponse(**data)


@router.post("/ingest", status_code=202)
def ingest_certificados_endpoint(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.ADMIN)),
):
    """Agenda a ingestão de certificados diretamente do diretório padrão."""

    def job() -> None:
        db = SessionLocal()
        try:
            cert_dir = os.getenv("CERTIFICADOS_DIR", r"G:\\CERTIFICADOS DIGITAIS")
            ingest_certificados(cert_dir, str(current_user.org_id), db)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
            raise
        finally:
            db.close()

    background_tasks.add_task(job)
    return {"message": "Ingestão de certificados agendada"}
