from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.normalization import normalize_municipio
from app.core.org_context import get_current_org
from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.company import Company
from app.models.company_process import CompanyProcess
from app.models.org import Org
from app.models.user import User
from app.schemas.company_process import (
    CompanyProcessCreate,
    CompanyProcessObsHistoryItem,
    CompanyProcessObsUpdate,
    CompanyProcessOut,
    CompanyProcessUpdate,
)


router = APIRouter()


def _get_process_or_404(db: Session, org_id: str, process_id: str) -> CompanyProcess:
    proc = (
        db.query(CompanyProcess)
        .filter(CompanyProcess.id == process_id, CompanyProcess.org_id == org_id)
        .first()
    )
    if not proc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Process not found")
    return proc


@router.post("", response_model=CompanyProcessOut)
def create_process(
    payload: CompanyProcessCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyProcessOut:
    # sanity check company belongs to org
    company = (
        db.query(Company)
        .filter(Company.id == payload.company_id, Company.org_id == org.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    data = payload.model_dump(exclude_none=True)
    if "municipio" in data:
        data["municipio"] = normalize_municipio(data.get("municipio"))
    proc = CompanyProcess(org_id=org.id, **data)
    db.add(proc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Process already exists for this company (same type + protocolo)",
        )
    db.refresh(proc)
    return CompanyProcessOut.model_validate(proc)


@router.get("/{process_id}", response_model=CompanyProcessOut)
def get_process(
    process_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> CompanyProcessOut:
    proc = _get_process_or_404(db, org.id, process_id)
    return CompanyProcessOut.model_validate(proc)


@router.patch("/{process_id}", response_model=CompanyProcessOut)
def update_process(
    process_id: str,
    payload: CompanyProcessUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyProcessOut:
    proc = _get_process_or_404(db, org.id, process_id)
    data = payload.model_dump(exclude_unset=True)
    if "municipio" in data:
        data["municipio"] = normalize_municipio(data.get("municipio"))
    for key, value in data.items():
        setattr(proc, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update would violate process natural key (type + protocolo)",
        )
    db.refresh(proc)
    return CompanyProcessOut.model_validate(proc)


@router.patch("/{process_id}/obs", response_model=CompanyProcessOut)
def update_process_obs(
    process_id: str,
    payload: CompanyProcessObsUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(get_current_user),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyProcessOut:
    proc = _get_process_or_404(db, org.id, process_id)

    new_obs = payload.obs
    old_obs = proc.obs

    history = proc.obs_history or []
    history.append(
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "actor_id": getattr(user, "id", None),
            "actor_email": getattr(user, "email", None),
            "old_value": old_obs,
            "new_value": new_obs,
            "action": "updated",
        }
    )
    # safety cap
    proc.obs_history = history[-200:]
    proc.obs = new_obs

    db.commit()
    db.refresh(proc)
    return CompanyProcessOut.model_validate(proc)


@router.get("/{process_id}/obs-history", response_model=list[CompanyProcessObsHistoryItem])
def get_process_obs_history(
    process_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> list[CompanyProcessObsHistoryItem]:
    proc = _get_process_or_404(db, org.id, process_id)
    hist = proc.obs_history or []
    # garante formato previsível
    return [CompanyProcessObsHistoryItem(**item) for item in hist]
