from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.normalization import normalize_municipio
from app.core.org_context import get_current_org
from app.core.security import get_current_user, require_roles, verify_password
from app.db.session import get_db
from app.models.company import Company
from app.models.company_process import CompanyProcess
from app.models.org import Org
from app.models.user import User
from app.schemas.auth import PasswordConfirmRequest
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
    data = payload.model_dump(
        exclude_none=True,
        exclude={"company_cnpj", "company_razao_social", "empresa_nao_cadastrada"},
    )
    process_type = str(data.get("process_type") or "").strip()

    if payload.company_id:
        company = (
            db.query(Company)
            .filter(Company.id == payload.company_id, Company.org_id == org.id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    else:
        if process_type != "DIVERSOS":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only process_type DIVERSOS can be created without a registered company",
            )
        if not str(payload.company_razao_social or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="company_razao_social is required for unregistered company process",
            )
        if not str(payload.company_cnpj or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="company_cnpj is required for unregistered company process",
            )
        raw = dict(data.get("raw") or {})
        raw["empresa_nao_cadastrada"] = True
        raw["company_cnpj"] = payload.company_cnpj
        raw["company_razao_social"] = str(payload.company_razao_social).strip()
        # campos usados no frontend para exibição
        raw["cnpj"] = payload.company_cnpj
        raw["empresa"] = str(payload.company_razao_social).strip()
        data["raw"] = raw
        data["company_id"] = None

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


@router.delete("/{process_id}")
def delete_process(
    process_id: str,
    payload: PasswordConfirmRequest,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> dict:
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    proc = _get_process_or_404(db, org.id, process_id)
    db.delete(proc)
    db.commit()
    return {"status": "ok"}
