import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.normalization import (
    extract_primary_phone_digits,
    normalize_email,
    normalize_generic_status,
    normalize_municipio,
    normalize_spaces,
    normalize_title_case,
)
from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.models.org import Org
from app.schemas.company import CompanyOut, enrich_company_with_profile
from app.schemas.company_composite import CompanyCompositeCreate


router = APIRouter()


def _normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 14:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CNPJ invalido")
    return digits


@router.post("/composite", response_model=CompanyOut)
def create_company_composite(
    payload: CompanyCompositeCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyOut:
    c = payload.company.model_dump(exclude_none=True)
    c["cnpj"] = _normalize_cnpj(c["cnpj"])
    c["razao_social"] = normalize_title_case(c.get("razao_social")) or c["razao_social"]
    if c.get("nome_fantasia"):
        c["nome_fantasia"] = normalize_title_case(c["nome_fantasia"])
    c["municipio"] = normalize_municipio(c.get("municipio"))
    c["uf"] = normalize_spaces(c.get("uf")).upper()[:2] or None

    company = Company(org_id=org.id, **c)
    db.add(company)
    try:
        db.flush()  # pega company.id sem commit
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company already exists for this org",
        )

    p = payload.profile.model_dump(exclude_none=True)
    mei = bool(p.pop("mei", False))
    endereco_fiscal = bool(p.pop("endereco_fiscal", False))
    if "email" in p:
        p["email"] = normalize_email(p.get("email"))
    if "telefone" in p:
        p["telefone"] = extract_primary_phone_digits(p.get("telefone"))
    if "proprietario_principal" in p:
        p["proprietario_principal"] = normalize_title_case(p.get("proprietario_principal"))
    categoria = p.get("categoria")
    if endereco_fiscal and categoria and not str(categoria).startswith("Fiscal -"):
        p["categoria"] = f"Fiscal - {categoria}"

    profile_raw = {"mei": mei, "endereco_fiscal": endereco_fiscal}
    profile = CompanyProfile(org_id=org.id, company_id=company.id, raw=profile_raw, **p)
    db.add(profile)

    # Licenças opcionais
    if payload.licences is not None:
        l = payload.licences.model_dump()
        if l.pop("nao_necessita", False):
            lic = CompanyLicence(
                org_id=org.id,
                company_id=company.id,
                municipio=company.municipio,
                alvara_vig_sanitaria="nao_exigido",
                alvara_funcionamento="nao_exigido",
                cercon="nao_exigido",
                licenca_ambiental="nao_exigido",
                certidao_uso_solo="nao_exigido",
                motivo_nao_exigido="cadastro_inicial_nao_necessita",
                justificativa_nao_exigido="Marcado no cadastro inicial como não necessitando licenças.",
            )
        else:
            def _lic(v: bool) -> str:
                return normalize_generic_status("sujeito" if v else "isento") or "isento"
            lic = CompanyLicence(
                org_id=org.id,
                company_id=company.id,
                municipio=company.municipio,
                alvara_vig_sanitaria=_lic(l.get("alvara_sanitario", False)),
                alvara_funcionamento=_lic(l.get("alvara_funcionamento", False)),
                cercon=_lic(l.get("cercon", False)),
                licenca_ambiental=_lic(l.get("licenca_ambiental", False)),
                certidao_uso_solo=_lic(l.get("certidao_uso_solo", False)),
            )
        db.add(lic)

    # Taxas opcionais
    if payload.taxes is not None:
        t = payload.taxes.model_dump()
        def _tax(v: bool) -> str:
            return "isento" if mei else ("em_aberto" if v else "isento")
        tax = CompanyTax(
            org_id=org.id,
            company_id=company.id,
            data_envio=None,
            taxa_funcionamento=_tax(t.get("funcionamento", False)),
            taxa_publicidade=_tax(t.get("publicidade", False)),
            taxa_vig_sanitaria=_tax(t.get("vigilancia_sanitaria", False)),
            taxa_localiz_instalacao=_tax(t.get("localizacao_instalacao", False)),
            taxa_ocup_area_publica=_tax(t.get("ocupacao_area_publica", False)),
            tpi=_tax(t.get("tpi", False)),
            vencimento_tpi=(None if mei else t.get("vencimento_tpi")),
        )
        db.add(tax)

    db.commit()
    db.refresh(company)
    company = enrich_company_with_profile(company)
    return CompanyOut.model_validate(company)
