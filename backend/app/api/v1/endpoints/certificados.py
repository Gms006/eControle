from __future__ import annotations

import logging
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


logger = logging.getLogger(__name__)

# Diretório padrão dos .pfx; pode ser sobrescrito por variável de ambiente
CERTIFICADOS_DIR_ENV = "ECONTROLE_CERTIFICADOS_DIR"
DEFAULT_CERTIFICADOS_DIR = r"G:\CERTIFICADOS DIGITAIS"

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


@router.post("/ingest")
def disparar_ingest_certificados(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Dispara a ingestão de certificados a partir do diretório configurado.

    Usa o pipeline core de S4.1 (`app.services.certificados_ingest.ingest_certificados`),
    fazendo upsert em `certificados` e refletindo em `v_certificados_status`.
    """

    certificados_dir = os.environ.get(CERTIFICADOS_DIR_ENV, DEFAULT_CERTIFICADOS_DIR)
    org_id = str(current_user.org_id)

    def job(dir_path: str, org_id_: str) -> None:
        db = SessionLocal()
        try:
            processed = ingest_certificados(dir_path, org_id_, db)
            logger.info(
                "Ingestão de certificados finalizada: org_id=%s dir=%s processed=%s",
                org_id_,
                dir_path,
                processed,
            )
        except Exception:
            logger.exception(
                "Erro ao ingerir certificados: org_id=%s dir=%s", org_id_, dir_path
            )
            db.rollback()
        finally:
            db.close()

    background_tasks.add_task(job, certificados_dir, org_id)

    return {
        "message": "Ingestão de certificados agendada",
        "certificados_dir": certificados_dir,
    }
