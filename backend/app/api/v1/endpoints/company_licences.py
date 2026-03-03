import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.normalization import normalize_municipio
from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company import Company
from app.models.org import Org
from app.models.company_licence import CompanyLicence
from app.schemas.company_licence import CompanyLicenceItemUpdate, CompanyLicenceOut

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_company_name(company: Company | None, company_id: str) -> tuple[str, bool]:
    if company and company.razao_social:
        return company.razao_social, False
    return f"Empresa não vinculada (ID {company_id})", True


def _to_company_licence_out(licence: CompanyLicence, company: Company | None) -> CompanyLicenceOut:
    company_name, sem_vinculo = _resolve_company_name(company, licence.company_id)
    if sem_vinculo:
        logger.warning(
            "company_licence_sem_vinculo org_id=%s licence_id=%s company_id=%s",
            licence.org_id,
            licence.id,
            licence.company_id,
        )

    payload = {
        **CompanyLicenceOut.model_validate(licence).model_dump(),
        "company_name": company_name,
        "company_cnpj": getattr(company, "cnpj", None),
        "company_razao_social": getattr(company, "razao_social", None),
        "company_municipio": getattr(company, "municipio", None) or licence.municipio,
        "sem_vinculo": sem_vinculo,
    }
    return CompanyLicenceOut.model_validate(payload)


@router.get("", response_model=list[CompanyLicenceOut])
def list_company_licences(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyLicenceOut]:
    rows = (
        db.query(CompanyLicence, Company)
        .outerjoin(
            Company,
            (Company.id == CompanyLicence.company_id) & (Company.org_id == CompanyLicence.org_id),
        )
        .filter(CompanyLicence.org_id == org.id)
        .order_by(CompanyLicence.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_company_licence_out(licence, company) for licence, company in rows]


@router.patch("/{licence_id}/item", response_model=CompanyLicenceOut)
def patch_company_licence_item(
    licence_id: str,
    payload: CompanyLicenceItemUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyLicenceOut:
    licence = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.id == licence_id, CompanyLicence.org_id == org.id)
        .first()
    )
    if not licence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licence not found")

    setattr(licence, payload.field, payload.status)

    raw = licence.raw if isinstance(licence.raw, dict) else {}
    if payload.validade:
        raw[f"validade_{payload.field}"] = payload.validade
    if payload.observacao is not None:
        raw[f"{payload.field}_observacao"] = payload.observacao
    if payload.responsavel is not None:
        raw[f"{payload.field}_responsavel"] = payload.responsavel
    if payload.proxima_acao is not None:
        raw[f"{payload.field}_proxima_acao"] = payload.proxima_acao

    if payload.status == "nao_exigido":
        licence.motivo_nao_exigido = payload.motivo_nao_exigido
        licence.justificativa_nao_exigido = payload.justificativa_nao_exigido
        raw[f"{payload.field}_motivo_nao_exigido"] = payload.motivo_nao_exigido
        raw[f"{payload.field}_justificativa_nao_exigido"] = payload.justificativa_nao_exigido
    else:
        licence.motivo_nao_exigido = None
        licence.justificativa_nao_exigido = None
        if raw.get(f"{payload.field}_motivo_nao_exigido"):
            raw[f"{payload.field}_motivo_nao_exigido"] = None
        if raw.get(f"{payload.field}_justificativa_nao_exigido"):
            raw[f"{payload.field}_justificativa_nao_exigido"] = None

    if payload.validade:
        year, month, day = payload.validade.split("-")
        raw[f"validade_{payload.field}_br"] = f"{day}/{month}/{year}"

    licence.municipio = normalize_municipio(licence.municipio)
    licence.raw = raw

    db.commit()
    db.refresh(licence)

    company = (
        db.query(Company)
        .filter(Company.id == licence.company_id, Company.org_id == org.id)
        .first()
    )
    return _to_company_licence_out(licence, company)
