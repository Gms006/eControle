from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from sqlalchemy.orm import Session

from app.core.cnae import normalize_cnae_code
from app.models.cnae_risk_suggestion import CNAERiskSuggestion
from app.schemas.cnae_risk_suggestion import CNAERiskSuggestionOut
from app.schemas.official_sources import OfficialSourceError, OfficialSourceFinding, OfficialSourceName
from app.services.cnae_risk_suggestions import create_suggestion
from app.services.official_sources.anapolis import lookup_cnae as lookup_anapolis
from app.services.official_sources.anvisa import lookup_cnae as lookup_anvisa
from app.services.official_sources.cbmgo import lookup_cnae as lookup_cbmgo
from app.services.official_sources.cgsim import lookup_cnae as lookup_cgsim
from app.services.official_sources.goiania import lookup_cnae as lookup_goiania


OFFICIAL_SOURCE_ADAPTERS: dict[OfficialSourceName, Callable[[str], list[OfficialSourceFinding]]] = {
    "CGSIM": lookup_cgsim,
    "ANVISA": lookup_anvisa,
    "ANAPOLIS": lookup_anapolis,
    "GOIANIA": lookup_goiania,
    "CBMGO": lookup_cbmgo,
}

_MUNICIPAL_SOURCES: set[OfficialSourceName] = {"ANAPOLIS", "GOIANIA"}


@dataclass
class OfficialLookupResult:
    findings: list[OfficialSourceFinding]
    suggestions_created: list[CNAERiskSuggestion]
    skipped_duplicates: int
    source_errors: list[OfficialSourceError]


def _build_evidence_excerpt(finding: OfficialSourceFinding) -> str:
    header = (
        f"[domain={finding.domain}]"
        f"[confidence={finding.confidence:.2f}]"
        f"[requires_questionnaire={'true' if finding.requires_questionnaire else 'false'}]"
    )
    return f"{header} {finding.evidence_excerpt}".strip()


def _finding_to_suggestion_payload(org_id: str, finding: OfficialSourceFinding) -> dict:
    payload = {
        "org_id": org_id,
        "cnae_code": finding.cnae_code,
        "source_name": finding.source_name,
        "source_reference": finding.source_reference,
        "evidence_excerpt": _build_evidence_excerpt(finding),
    }

    if finding.domain == "general":
        payload["suggested_risk_tier"] = finding.suggested_risk_tier
        payload["suggested_base_weight"] = finding.suggested_base_weight
    elif finding.domain == "sanitary":
        payload["suggested_sanitary_risk"] = finding.suggested_risk_tier
    elif finding.domain == "fire":
        if not finding.requires_questionnaire:
            payload["suggested_fire_risk"] = finding.suggested_risk_tier
    elif finding.domain == "environmental":
        payload["suggested_environmental_risk"] = finding.suggested_risk_tier
    elif finding.domain == "municipal":
        payload["suggested_risk_tier"] = finding.suggested_risk_tier
        payload["suggested_base_weight"] = finding.suggested_base_weight

    return payload


def _is_duplicate_pending(
    db: Session,
    org_id: str,
    payload: dict,
) -> bool:
    query = db.query(CNAERiskSuggestion).filter(
        CNAERiskSuggestion.status == "PENDING",
        CNAERiskSuggestion.cnae_code == payload["cnae_code"],
        CNAERiskSuggestion.source_name == payload["source_name"],
        CNAERiskSuggestion.source_reference == payload.get("source_reference"),
        CNAERiskSuggestion.org_id == org_id,
    )
    existing = query.first()
    if not existing:
        return False

    comparable_fields = (
        "suggested_risk_tier",
        "suggested_base_weight",
        "suggested_sanitary_risk",
        "suggested_fire_risk",
        "suggested_environmental_risk",
        "evidence_excerpt",
    )
    for field in comparable_fields:
        if getattr(existing, field) != payload.get(field):
            return False
    return True


def run_official_lookup_and_create_suggestions(
    db: Session,
    *,
    org_id: str,
    cnae_codes: list[str],
    sources: list[OfficialSourceName] | None = None,
) -> OfficialLookupResult:
    source_names = _resolve_source_names(sources)
    normalized_codes: list[str] = []
    for item in cnae_codes:
        code = normalize_cnae_code(item)
        if not code:
            continue
        if code not in normalized_codes:
            normalized_codes.append(code)

    findings: list[OfficialSourceFinding] = []
    source_errors: list[OfficialSourceError] = []
    for source_name in source_names:
        adapter = OFFICIAL_SOURCE_ADAPTERS[source_name]
        for code in normalized_codes:
            try:
                source_findings = adapter(code)
            except Exception as exc:
                source_errors.append(OfficialSourceError(source_name=source_name, message=str(exc)))
                continue
            findings.extend(source_findings)

    created: list[CNAERiskSuggestion] = []
    skipped_duplicates = 0
    for finding in findings:
        payload = _finding_to_suggestion_payload(org_id, finding)
        if _is_duplicate_pending(db, org_id, payload):
            skipped_duplicates += 1
            continue
        suggestion = create_suggestion(db, org_id=org_id, payload=payload)
        created.append(suggestion)

    return OfficialLookupResult(
        findings=findings,
        suggestions_created=created,
        skipped_duplicates=skipped_duplicates,
        source_errors=source_errors,
    )


def _resolve_source_names(sources: list[OfficialSourceName] | None) -> list[OfficialSourceName]:
    if sources:
        source_names: list[OfficialSourceName] = []
        for source in sources:
            if source not in source_names:
                source_names.append(source)
    else:
        # Municipal default prioritario para Anapolis.
        source_names = ["CGSIM", "ANVISA", "ANAPOLIS", "CBMGO"]

    if not any(source in _MUNICIPAL_SOURCES for source in source_names):
        source_names.append("ANAPOLIS")

    return source_names


def serialize_created_suggestions(items: list[CNAERiskSuggestion]) -> list[CNAERiskSuggestionOut]:
    return [CNAERiskSuggestionOut.model_validate(item) for item in items]
