from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.company_licence import CompanyLicence
from app.schemas.company_licence import CompanyLicenceOut

router = APIRouter()


@router.get("", response_model=list[CompanyLicenceOut])
def list_company_licences(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyLicenceOut]:
    licences = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.org_id == org.id)
        .order_by(CompanyLicence.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [CompanyLicenceOut.model_validate(licence) for licence in licences]
