from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_org

router = APIRouter(prefix="/municipios", tags=["Municipios"])


@router.get("")
def listar_municipios(db: Session = Depends(get_db), ctx=Depends(require_org)):
    rows = db.execute(
        text(
            """
            SELECT DISTINCT municipio
            FROM empresas
            WHERE org_id = :org
              AND municipio IS NOT NULL AND municipio <> ''
            ORDER BY municipio
            """
        ),
        {"org": str(ctx.org_id)},
    ).all()
    items = [row[0] for row in rows]
    return {"items": items, "total": len(items), "page": 1, "size": len(items)}
