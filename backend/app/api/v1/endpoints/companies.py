import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.org import Org
from app.schemas.company import CompanyCreate, CompanyOut, CompanyUpdate, enrich_company_with_profile

router = APIRouter()


def _normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNPJ invalido",
        )
    return digits


@router.post("", response_model=CompanyOut)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyOut:
    data = payload.model_dump(exclude_none=True)
    data["cnpj"] = _normalize_cnpj(data["cnpj"])
    company = Company(org_id=org.id, **data)
    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company already exists for this org",
        )
    db.refresh(company)
    return CompanyOut.model_validate(enrich_company_with_profile(company))


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    cnpj: str | None = Query(default=None),
    razao_social: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyOut]:
    query = db.query(Company).filter(Company.org_id == org.id).outerjoin(
        CompanyProfile, (Company.id == CompanyProfile.company_id) & (Company.org_id == CompanyProfile.org_id)
    )
    if cnpj:
        query = query.filter(Company.cnpj == _normalize_cnpj(cnpj))
    if razao_social:
        query = query.filter(Company.razao_social.ilike(f"%{razao_social}%"))
    if is_active is not None:
        query = query.filter(Company.is_active == is_active)
    companies = (
        query.order_by(Company.created_at.desc()).offset(offset).limit(limit).all()
    )
    return [CompanyOut.model_validate(enrich_company_with_profile(company)) for company in companies]


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> CompanyOut:
    company = (
        db.query(Company)
        .options(joinedload(Company.profile))
        .outerjoin(
            CompanyProfile, (Company.id == CompanyProfile.company_id) & (Company.org_id == CompanyProfile.org_id)
        )
        .filter(Company.id == company_id, Company.org_id == org.id)
        .first()
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    company = enrich_company_with_profile(company)
    return CompanyOut.model_validate(enrich_company_with_profile(company))


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyOut:
    company = (
        db.query(Company)
        .outerjoin(
            CompanyProfile, (Company.id == CompanyProfile.company_id) & (Company.org_id == CompanyProfile.org_id)
        )
        .filter(Company.id == company_id, Company.org_id == org.id)
        .first()
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_active") is None:
        data.pop("is_active", None)
    if "cnpj" in data and data["cnpj"] is not None:
        data["cnpj"] = _normalize_cnpj(data["cnpj"])
    for key, value in data.items():
        setattr(company, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company already exists for this org",
        )
    db.refresh(company)
    return CompanyOut.model_validate(enrich_company_with_profile(company))
