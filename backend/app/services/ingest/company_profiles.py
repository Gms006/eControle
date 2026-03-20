from __future__ import annotations
from sqlalchemy.orm import Session

from app.core.cnae import normalize_cnae_list
from app.core.normalization import normalize_generic_status
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.services.company_scoring import recalculate_company_score
from app.services.ingest.utils import normalize_digits, normalize_cnpj, repair_mojibake_utf8, sanitize_text_tree


_ISENTO_MARKERS = {"-", "8"}


def _null_if_isento(value: str | None) -> str | None:
    if value is None:
        return None
    v = repair_mojibake_utf8(str(value)).strip()
    if v in _ISENTO_MARKERS:
        return None
    return v


def upsert_company_profiles(db: Session, org_id: str, items: list[dict]) -> tuple[int, int]:
    inserted = 0
    updated = 0

    for item in items:
        cnpj = normalize_cnpj(item.get("cnpj", ""))
        if not cnpj:
            continue

        company = db.query(Company).filter(Company.org_id == org_id, Company.cnpj == cnpj).first()
        if not company:
            continue

        payload = {
            "external_id": repair_mojibake_utf8(item.get("external_id")),
            "porte": _null_if_isento(item.get("porte")),
            "status_empresa": normalize_generic_status(_null_if_isento(item.get("status_empresa")), strict=False),
            "categoria": _null_if_isento(item.get("categoria")),
            "inscricao_estadual": _null_if_isento(item.get("inscricao_estadual")),
            "inscricao_municipal": _null_if_isento(item.get("inscricao_municipal")),
            "situacao": normalize_generic_status(_null_if_isento(item.get("situacao")), strict=False),
            "certificado_digital": _null_if_isento(item.get("certificado_digital")),
            "observacoes": _null_if_isento(item.get("observacoes")),
            "proprietario_principal": _null_if_isento(item.get("proprietario_principal")),
            "cpf": normalize_digits(item.get("cpf") or "") or None,
            "telefone": normalize_digits(item.get("telefone") or "") or None,
            "email": _null_if_isento(item.get("email")),
            "responsavel_fiscal": _null_if_isento(item.get("responsavel_fiscal")),
            "cnaes_principal": normalize_cnae_list(item.get("cnaes_principal")),
            "cnaes_secundarios": normalize_cnae_list(item.get("cnaes_secundarios")),
            "raw": sanitize_text_tree(item.get("raw")),
        }

        existing = (
            db.query(CompanyProfile)
            .filter(CompanyProfile.org_id == org_id, CompanyProfile.company_id == company.id)
            .first()
        )
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            updated += 1
            recalculate_company_score(db, org_id, company.id)
        else:
            db.add(CompanyProfile(org_id=org_id, company_id=company.id, **payload))
            inserted += 1
            db.flush()
            recalculate_company_score(db, org_id, company.id)

    return inserted, updated
