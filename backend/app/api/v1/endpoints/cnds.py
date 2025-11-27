from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps.auth import Role, User, db_with_org, require_role
from app.models.cnds import Cnd
from app.schemas.cnds import CndView

router = APIRouter(prefix="/cnds", tags=["CNDs"])


@router.get("", response_model=List[CndView])
@router.get("/", response_model=List[CndView])
def listar_cnds(
    orgao: str | None = Query(None, description="Filtra por órgão"),
    esfera: str | None = Query(None, description="Filtra por esfera"),
    status: str | None = Query(None, description="Filtra por status"),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> List[CndView]:
    query = db.query(Cnd)
    if orgao:
        query = query.filter(Cnd.orgao.ilike(f"%{orgao}%"))
    if esfera:
        query = query.filter(Cnd.esfera.ilike(f"%{esfera}%"))
    if status:
        query = query.filter(Cnd.status.ilike(f"%{status}%"))

    return query.order_by(Cnd.validade.desc().nulls_last()).all()
