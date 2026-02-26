from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.company_profile import CompanyProfile
from app.schemas.company_profile import CompanyProfileOut

router = APIRouter()


@router.get("", response_model=list[CompanyProfileOut])
def list_company_profiles(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyProfileOut]:
    profiles = (
        db.query(CompanyProfile)
        .filter(CompanyProfile.org_id == org.id)
        .order_by(CompanyProfile.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [CompanyProfileOut.model_validate(profile) for profile in profiles]
