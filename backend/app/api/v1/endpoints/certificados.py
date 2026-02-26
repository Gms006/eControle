from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org

router = APIRouter()


@router.get("", response_model=list)
def list_certificados(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list:
    # TODO: Implementar integração com CertHub para sincronizar certificados
    # Por enquanto, retorna lista vazia
    return []
