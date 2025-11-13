from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_org

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])


@router.get("")
@router.get("/")
def listar_agendamentos(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    _: object = Depends(require_org),
) -> dict[str, int | list[dict]]:
    """Stub de agendamentos para evitar 404 até que o domínio seja implementado."""
    return {"items": [], "total": 0, "page": page, "size": size}
