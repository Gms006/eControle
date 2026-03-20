from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.cnae import extract_cnae_codes
from app.models.cnae_risk import CNAERisk
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_profile import CompanyProfile


RISK_PRIORITY = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
RISK_BY_PRIORITY = {value: key for key, value in RISK_PRIORITY.items()}
LICENCE_VALID_UNTIL_FIELDS = (
    "alvara_vig_sanitaria_valid_until",
    "cercon_valid_until",
    "alvara_funcionamento_valid_until",
    "licenca_ambiental_valid_until",
    "certidao_uso_solo_valid_until",
)


def _extract_cnae_codes(profile: CompanyProfile | None) -> list[str]:
    if not profile:
        return []
    return extract_cnae_codes(profile.cnaes_principal, profile.cnaes_secundarios)


def _expiry_weight(next_expiry: date | None, today: date) -> int:
    if not next_expiry:
        return 0
    days_to_expiry = (next_expiry - today).days
    if days_to_expiry < 0:
        return 50
    if days_to_expiry <= 7:
        return 40
    if days_to_expiry <= 30:
        return 25
    if days_to_expiry <= 60:
        return 10
    return 0


def _pick_nearest_licence_expiry(licence: CompanyLicence | None) -> date | None:
    if not licence:
        return None
    valid_dates = [
        value
        for value in (getattr(licence, field, None) for field in LICENCE_VALID_UNTIL_FIELDS)
        if isinstance(value, date)
    ]
    if not valid_dates:
        return None
    return min(valid_dates)


def recalculate_company_score(db: Session, org_id: str, company_id: str) -> dict[str, Any]:
    company = db.query(Company).filter(Company.org_id == org_id, Company.id == company_id).first()
    if not company:
        return {"updated": False, "status": "COMPANY_NOT_FOUND"}

    profile = (
        db.query(CompanyProfile)
        .filter(CompanyProfile.org_id == org_id, CompanyProfile.company_id == company_id)
        .first()
    )
    if not profile:
        profile = CompanyProfile(org_id=org_id, company_id=company_id)
        db.add(profile)
        db.flush()

    cnae_codes = _extract_cnae_codes(profile)
    cnae_rows: list[CNAERisk] = []
    if cnae_codes:
        cnae_rows = (
            db.query(CNAERisk)
            .filter(CNAERisk.is_active.is_(True), CNAERisk.cnae_code.in_(cnae_codes))
            .all()
        )

    highest_risk_priority = max(
        (RISK_PRIORITY.get(str(row.risk_tier or "").strip().upper(), 0) for row in cnae_rows),
        default=0,
    )
    risco_consolidado = RISK_BY_PRIORITY.get(highest_risk_priority)

    maior_base_weight = max((int(row.base_weight or 0) for row in cnae_rows), default=0)

    licence = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.org_id == org_id, CompanyLicence.company_id == company_id)
        .first()
    )
    nearest_expiry = _pick_nearest_licence_expiry(licence)
    peso_vencimento = _expiry_weight(nearest_expiry, date.today())

    score_urgencia = maior_base_weight + peso_vencimento

    if not cnae_codes:
        score_status = "NO_CNAE"
    elif not cnae_rows:
        score_status = "UNMAPPED_CNAE"
    elif nearest_expiry is None:
        score_status = "NO_LICENCE"
    else:
        score_status = "OK"

    changed = (
        profile.risco_consolidado != risco_consolidado
        or profile.score_urgencia != score_urgencia
        or profile.score_status != score_status
    )
    profile.risco_consolidado = risco_consolidado
    profile.score_urgencia = score_urgencia
    profile.score_status = score_status
    profile.score_updated_at = datetime.now(timezone.utc)

    return {
        "updated": True,
        "changed": changed,
        "company_id": company_id,
        "risco_consolidado": risco_consolidado,
        "score_urgencia": score_urgencia,
        "score_status": score_status,
        "cnae_codes": cnae_codes,
        "matched_cnaes": len(cnae_rows),
        "nearest_licence_expiry": nearest_expiry.isoformat() if nearest_expiry else None,
        "peso_vencimento": peso_vencimento,
    }
