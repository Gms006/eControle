from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.schemas.org import OrgOut

router = APIRouter()


@router.get("/current", response_model=OrgOut)
def get_org_current(org: Org = Depends(get_current_org)) -> OrgOut:
    return OrgOut.model_validate(org)


@router.get("/list", response_model=list[OrgOut])
def list_orgs(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> list[OrgOut]:
    orgs = (
        db.query(Org)
        .order_by(Org.created_at.desc())
        .limit(50)
        .all()
    )
    return [OrgOut.model_validate(org) for org in orgs]
