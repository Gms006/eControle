from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.cnae import extract_cnae_codes
from app.models.cnae_risk import CNAERisk
from app.models.company_licence import CompanyLicence
from app.models.company_profile import CompanyProfile
from app.services.company_scoring import _expiry_weight

RISK_PRIORITY = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
RISK_BY_PRIORITY = {value: key for key, value in RISK_PRIORITY.items()}
LICENCE_FIELDS = (
    "alvara_vig_sanitaria_valid_until",
    "cercon_valid_until",
    "alvara_funcionamento_valid_until",
    "licenca_ambiental_valid_until",
    "certidao_uso_solo_valid_until",
)


def _nearest_expiry(validities: dict[str, date | None]) -> date | None:
    values = [value for value in validities.values() if isinstance(value, date)]
    return min(values) if values else None


def _compute_score(base_weight: int, validities: dict[str, date | None]) -> int:
    nearest = _nearest_expiry(validities)
    return int(base_weight) + _expiry_weight(nearest, date.today())


def _parse_simulation_actions(message: str) -> list[tuple[str, str]]:
    text = (message or "").strip().lower()
    actions: list[tuple[str, str]] = []
    mapping = (
        ("cercon_valid_until", ("bombeiro", "cercon")),
        ("alvara_vig_sanitaria_valid_until", ("sanitari",)),
        ("alvara_funcionamento_valid_until", ("funcionamento",)),
        ("licenca_ambiental_valid_until", ("ambiental",)),
        ("certidao_uso_solo_valid_until", ("uso do solo", "uso_solo", "solo")),
    )
    for field, keywords in mapping:
        if any(keyword in text for keyword in keywords):
            actions.append((field, "renovar validade por 365 dias"))
    if not actions:
        actions.append(("cercon_valid_until", "cenário base: renovação de bombeiros"))
    return actions


def simulate_company_risk_impact(
    db: Session,
    *,
    org_id: str,
    company_id: str,
    message: str,
) -> dict[str, Any]:
    profile = (
        db.query(CompanyProfile)
        .filter(CompanyProfile.org_id == org_id, CompanyProfile.company_id == company_id)
        .first()
    )
    licence = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.org_id == org_id, CompanyLicence.company_id == company_id)
        .first()
    )
    cnae_codes = extract_cnae_codes(
        getattr(profile, "cnaes_principal", None),
        getattr(profile, "cnaes_secundarios", None),
    )
    cnae_rows = (
        db.query(CNAERisk)
        .filter(CNAERisk.is_active.is_(True), CNAERisk.cnae_code.in_(cnae_codes))
        .all()
        if cnae_codes
        else []
    )
    base_weight = max((int(row.base_weight or 0) for row in cnae_rows), default=0)
    risk_before = RISK_BY_PRIORITY.get(
        max((RISK_PRIORITY.get(str(row.risk_tier or "").upper(), 0) for row in cnae_rows), default=0)
    )
    current_validities = {field: getattr(licence, field, None) if licence else None for field in LICENCE_FIELDS}
    score_before = _compute_score(base_weight, current_validities)

    assumptions: list[str] = []
    simulated = dict(current_validities)
    for field, label in _parse_simulation_actions(message):
        simulated[field] = date.today() + timedelta(days=365)
        assumptions.append(f"{field}: {label}")
    score_after = _compute_score(base_weight, simulated)

    impacts: list[dict[str, Any]] = []
    for field in LICENCE_FIELDS:
        candidate = dict(current_validities)
        candidate[field] = date.today() + timedelta(days=365)
        candidate_score = _compute_score(base_weight, candidate)
        impacts.append(
            {
                "field": field,
                "score_after": candidate_score,
                "delta": candidate_score - score_before,
            }
        )
    impacts.sort(key=lambda item: item["delta"])

    return {
        "score_before": score_before,
        "score_after": score_after,
        "delta": score_after - score_before,
        "risk_tier_before": risk_before,
        "risk_tier_after": risk_before,
        "applied_assumptions": assumptions,
        "top_impacts": impacts[:3],
    }

