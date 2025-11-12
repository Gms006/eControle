from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])


@router.get("")
def listar_agendamentos(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200)):
    return {"items": [], "total": 0, "page": page, "size": size}
