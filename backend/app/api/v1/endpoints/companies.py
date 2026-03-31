import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.normalization import (
    extract_primary_phone_digits,
    normalize_email,
    normalize_generic_status,
    normalize_municipio,
    normalize_title_case,
)
from app.core.org_context import get_current_org
from app.core.security import require_roles, verify_password
from app.models.certificate_mirror import CertificateMirror
from app.db.session import get_db
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.models.licence_file_event import LicenceFileEvent
from app.models.org import Org
from app.models.user import User
from app.schemas.auth import PasswordConfirmRequest
from app.schemas.company import CompanyCreate, CompanyOut, CompanyUpdate, enrich_company_with_profile
from app.services.company_scoring import recalculate_company_score

router = APIRouter()


def _normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNPJ invalido",
        )
    return digits


def _normalize_cpf(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 11:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPF invalido",
        )
    return digits


def _normalize_company_document(cnpj: str | None, cpf: str | None) -> tuple[str | None, str | None]:
    cnpj_value = _normalize_cnpj(cnpj) if str(cnpj or "").strip() else None
    cpf_value = _normalize_cpf(cpf) if str(cpf or "").strip() else None
    if not cnpj_value and not cpf_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe CNPJ ou CPF")
    if cnpj_value and cpf_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe apenas um documento (CNPJ ou CPF)")
    return cnpj_value, cpf_value


@router.post("", response_model=CompanyOut)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyOut:
    data = payload.model_dump(exclude_none=True)
    cnpj, cpf = _normalize_company_document(data.get("cnpj"), data.get("company_cpf"))
    data["cnpj"] = cnpj
    data["cpf"] = cpf
    data.pop("company_cpf", None)
    if data.get("razao_social"):
        data["razao_social"] = normalize_title_case(data["razao_social"])
    if data.get("nome_fantasia"):
        data["nome_fantasia"] = normalize_title_case(data["nome_fantasia"])
    if data.get("municipio"):
        data["municipio"] = normalize_municipio(data["municipio"])
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
    company = enrich_company_with_profile(company)
    company.situacao_debito = "Sem Débitos"
    return CompanyOut.model_validate(company)


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
    cnpj: str | None = Query(default=None),
    cpf: str | None = Query(default=None),
    razao_social: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyOut]:
    query = (
        db.query(Company)
        .options(joinedload(Company.profile))
        .filter(Company.org_id == org.id)
        .outerjoin(CompanyProfile, (Company.id == CompanyProfile.company_id) & (Company.org_id == CompanyProfile.org_id))
    )
    if cnpj:
        query = query.filter(Company.cnpj == _normalize_cnpj(cnpj))
    if cpf:
        query = query.filter(Company.cpf == _normalize_cpf(cpf))
    if razao_social:
        query = query.filter(Company.razao_social.ilike(f"%{razao_social}%"))
    if is_active is not None:
        query = query.filter(Company.is_active == is_active)
    elif not include_inactive:
        query = query.filter(Company.is_active.is_(True))

    if include_inactive:
        role_names = {role.name for role in user.roles}
        if "ADMIN" not in role_names and "DEV" not in role_names:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    companies = (
        query.order_by(Company.created_at.desc()).offset(offset).limit(limit).all()
    )
    company_ids = [company.id for company in companies]
    taxa_rows = (
        db.query(CompanyTax)
        .filter(CompanyTax.org_id == org.id, CompanyTax.company_id.in_(company_ids))
        .all()
        if company_ids
        else []
    )
    taxes_by_company = {tax.company_id: tax for tax in taxa_rows}

    def _is_open(value: str | None) -> bool:
        return bool(value and "aberto" in str(value).strip().lower())

    result: list[CompanyOut] = []
    for company in companies:
        tax = taxes_by_company.get(company.id)
        has_open = False
        if tax:
            has_open = any(
                _is_open(value)
                for value in [
                    tax.taxa_funcionamento,
                    tax.taxa_publicidade,
                    tax.taxa_vig_sanitaria,
                    tax.taxa_localiz_instalacao,
                    tax.taxa_ocup_area_publica,
                    tax.tpi,
                    tax.status_taxas,
                ]
            )
        company = enrich_company_with_profile(company)
        company.situacao_debito = "Possui Débito" if has_open else "Sem Débitos"
        result.append(CompanyOut.model_validate(company))
    return result


@router.get("/municipios", response_model=list[str])
def list_companies_municipios(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
    include_inactive: bool = Query(default=False),
) -> list[str]:
    query = db.query(Company.municipio).filter(Company.org_id == org.id)
    if not include_inactive:
        query = query.filter(Company.is_active.is_(True))
    else:
        role_names = {role.name for role in user.roles}
        if "ADMIN" not in role_names and "DEV" not in role_names:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    values = [row[0] for row in query.all() if row[0]]
    normalized = sorted({normalize_municipio(value) for value in values if normalize_municipio(value)})
    return normalized


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
    tax = (
        db.query(CompanyTax)
        .filter(CompanyTax.org_id == org.id, CompanyTax.company_id == company.id)
        .first()
    )

    def _is_open(value: str | None) -> bool:
        return bool(value and "aberto" in str(value).strip().lower())

    has_open = False
    if tax:
        has_open = any(
            _is_open(value)
            for value in [
                tax.taxa_funcionamento,
                tax.taxa_publicidade,
                tax.taxa_vig_sanitaria,
                tax.taxa_localiz_instalacao,
                tax.taxa_ocup_area_publica,
                tax.tpi,
                tax.status_taxas,
            ]
        )
    company = enrich_company_with_profile(company)
    company.situacao_debito = "Possui Débito" if has_open else "Sem Débitos"
    return CompanyOut.model_validate(company)


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
    company_fields = {"cnpj", "company_cpf", "razao_social", "nome_fantasia", "fs_dirname", "municipio", "uf", "is_active"}
    profile_fields = set(data.keys()) - company_fields

    company_data = {k: v for k, v in data.items() if k in company_fields}
    if company_data.get("is_active") is None:
        company_data.pop("is_active", None)
    has_doc_update = ("cnpj" in company_data) or ("company_cpf" in company_data)
    if has_doc_update:
        next_cnpj = company_data.get("cnpj", company.cnpj)
        next_cpf = company_data.get("company_cpf", company.cpf)
        normalized_cnpj, normalized_cpf = _normalize_company_document(next_cnpj, next_cpf)
        company_data["cnpj"] = normalized_cnpj
        company_data["cpf"] = normalized_cpf
        company_data.pop("company_cpf", None)
    if "razao_social" in company_data:
        company_data["razao_social"] = normalize_title_case(company_data["razao_social"])
    if "nome_fantasia" in company_data:
        company_data["nome_fantasia"] = normalize_title_case(company_data["nome_fantasia"])
    if "municipio" in company_data:
        company_data["municipio"] = normalize_municipio(company_data["municipio"])
    for key, value in company_data.items():
        setattr(company, key, value)

    if profile_fields:
        profile = company.profile
        if not profile:
            profile = CompanyProfile(org_id=org.id, company_id=company.id)
            db.add(profile)
        for key in profile_fields:
            value = data[key]
            if key == "telefone":
                value = extract_primary_phone_digits(value)
            elif key == "email":
                value = normalize_email(value)
            elif key == "proprietario_principal":
                value = normalize_title_case(value)
            elif key in {"situacao", "status_empresa"}:
                value = normalize_generic_status(value, strict=False)
            elif key == "responsavel_fiscal":
                value = normalize_title_case(value)
            setattr(profile, key, value)
        db.flush()
        recalculate_company_score(db, org.id, company.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company already exists for this org",
        )
    db.refresh(company)
    tax = (
        db.query(CompanyTax)
        .filter(CompanyTax.org_id == org.id, CompanyTax.company_id == company.id)
        .first()
    )
    has_open = bool(
        tax
        and any(
            value and "aberto" in str(value).strip().lower()
            for value in [
                tax.taxa_funcionamento,
                tax.taxa_publicidade,
                tax.taxa_vig_sanitaria,
                tax.taxa_localiz_instalacao,
                tax.taxa_ocup_area_publica,
                tax.tpi,
                tax.status_taxas,
            ]
        )
    )
    company = enrich_company_with_profile(company)
    company.situacao_debito = "Possui Débito" if has_open else "Sem Débitos"
    return CompanyOut.model_validate(company)


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    payload: PasswordConfirmRequest,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> dict:
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.org_id == org.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    try:
        (
            db.query(CertificateMirror)
            .filter(CertificateMirror.org_id == org.id, CertificateMirror.company_id == company.id)
            .update({CertificateMirror.company_id: None}, synchronize_session=False)
        )
        db.query(CompanyProcess).filter(CompanyProcess.org_id == org.id, CompanyProcess.company_id == company.id).delete(
            synchronize_session=False
        )
        db.query(CompanyTax).filter(CompanyTax.org_id == org.id, CompanyTax.company_id == company.id).delete(
            synchronize_session=False
        )
        db.query(CompanyLicence).filter(CompanyLicence.org_id == org.id, CompanyLicence.company_id == company.id).delete(
            synchronize_session=False
        )
        db.query(CompanyProfile).filter(CompanyProfile.org_id == org.id, CompanyProfile.company_id == company.id).delete(
            synchronize_session=False
        )
        db.query(LicenceFileEvent).filter(
            LicenceFileEvent.org_id == org.id, LicenceFileEvent.company_id == company.id
        ).delete(synchronize_session=False)
        db.delete(company)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Unable to delete company")

    return {"status": "ok"}
