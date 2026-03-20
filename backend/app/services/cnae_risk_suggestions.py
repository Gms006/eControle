from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import AuditEvent, record_audit_event
from app.core.cnae import extract_cnae_codes
from app.models.cnae_risk import CNAERisk
from app.models.cnae_risk_suggestion import CNAERiskSuggestion
from app.models.company_profile import CompanyProfile
from app.services.company_scoring import recalculate_company_score


ALLOWED_STATUSES = {"PENDING", "APPROVED", "REJECTED", "APPLIED"}


def _get_suggestion_or_404(db: Session, org_id: str, suggestion_id: str) -> CNAERiskSuggestion:
    suggestion = (
        db.query(CNAERiskSuggestion)
        .filter(
            CNAERiskSuggestion.id == suggestion_id,
            (CNAERiskSuggestion.org_id == org_id) | CNAERiskSuggestion.org_id.is_(None),
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    return suggestion


def list_suggestions(
    db: Session,
    org_id: str,
    *,
    status_filter: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[CNAERiskSuggestion]:
    query = db.query(CNAERiskSuggestion).filter(
        (CNAERiskSuggestion.org_id == org_id) | CNAERiskSuggestion.org_id.is_(None)
    )
    normalized_status = str(status_filter or "").strip().upper()
    if normalized_status:
        if normalized_status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status filter")
        query = query.filter(CNAERiskSuggestion.status == normalized_status)
    return query.order_by(CNAERiskSuggestion.created_at.desc()).offset(offset).limit(limit).all()


def create_suggestion(db: Session, *, org_id: str, payload: dict) -> CNAERiskSuggestion:
    effective_org_id = payload.get("org_id")
    if effective_org_id is not None and effective_org_id != org_id:
        effective_org_id = org_id

    suggestion = CNAERiskSuggestion(
        org_id=effective_org_id,
        cnae_code=payload["cnae_code"],
        suggested_risk_tier=payload.get("suggested_risk_tier"),
        suggested_base_weight=payload.get("suggested_base_weight"),
        suggested_sanitary_risk=payload.get("suggested_sanitary_risk"),
        suggested_fire_risk=payload.get("suggested_fire_risk"),
        suggested_environmental_risk=payload.get("suggested_environmental_risk"),
        source_name=payload["source_name"],
        source_reference=payload.get("source_reference"),
        evidence_excerpt=payload.get("evidence_excerpt"),
        status="PENDING",
    )
    db.add(suggestion)
    db.flush()

    record_audit_event(
        AuditEvent(
            action="CNAE_RISK_SUGGESTION_CREATED",
            entity="cnae_risk_suggestions",
            entity_id=suggestion.id,
        )
    )
    return suggestion


def update_pending_suggestion(
    db: Session, *, org_id: str, suggestion_id: str, payload: dict
) -> CNAERiskSuggestion:
    suggestion = _get_suggestion_or_404(db, org_id, suggestion_id)
    if suggestion.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only PENDING suggestions can be edited",
        )

    for key, value in payload.items():
        setattr(suggestion, key, value)
    db.add(suggestion)
    db.flush()

    record_audit_event(
        AuditEvent(
            action="CNAE_RISK_SUGGESTION_UPDATED",
            entity="cnae_risk_suggestions",
            entity_id=suggestion.id,
        )
    )
    return suggestion


def reject_suggestion(
    db: Session,
    *,
    org_id: str,
    suggestion_id: str,
    reviewer_user_id: str,
    evidence_excerpt: str | None = None,
) -> CNAERiskSuggestion:
    suggestion = _get_suggestion_or_404(db, org_id, suggestion_id)
    if suggestion.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only PENDING suggestions can be rejected",
        )

    suggestion.status = "REJECTED"
    suggestion.reviewed_by = reviewer_user_id
    suggestion.reviewed_at = datetime.now(timezone.utc)
    if evidence_excerpt is not None:
        suggestion.evidence_excerpt = evidence_excerpt

    db.add(suggestion)
    db.flush()
    record_audit_event(
        AuditEvent(
            action="CNAE_RISK_SUGGESTION_REJECTED",
            entity="cnae_risk_suggestions",
            entity_id=suggestion.id,
            actor_id=reviewer_user_id,
        )
    )
    return suggestion


def _apply_suggestion_to_catalog(db: Session, suggestion: CNAERiskSuggestion) -> bool:
    risk = db.query(CNAERisk).filter(CNAERisk.cnae_code == suggestion.cnae_code).first()
    if not risk:
        risk = CNAERisk(
            cnae_code=suggestion.cnae_code,
            cnae_text=f"CNAE {suggestion.cnae_code}",
            risk_tier=suggestion.suggested_risk_tier,
            base_weight=int(suggestion.suggested_base_weight or 0),
            sanitary_risk=suggestion.suggested_sanitary_risk,
            fire_risk=suggestion.suggested_fire_risk,
            environmental_risk=suggestion.suggested_environmental_risk,
            source=suggestion.source_name,
            notes=suggestion.source_reference,
            is_active=True,
        )
        db.add(risk)
        db.flush()
        return True

    if suggestion.suggested_risk_tier is not None:
        risk.risk_tier = suggestion.suggested_risk_tier
    if suggestion.suggested_base_weight is not None:
        risk.base_weight = suggestion.suggested_base_weight
    if suggestion.suggested_sanitary_risk is not None:
        risk.sanitary_risk = suggestion.suggested_sanitary_risk
    if suggestion.suggested_fire_risk is not None:
        risk.fire_risk = suggestion.suggested_fire_risk
    if suggestion.suggested_environmental_risk is not None:
        risk.environmental_risk = suggestion.suggested_environmental_risk
    risk.source = suggestion.source_name
    if suggestion.source_reference:
        risk.notes = suggestion.source_reference
    risk.is_active = True
    db.add(risk)
    db.flush()
    return True


def _recalculate_affected_companies(db: Session, cnae_code: str) -> tuple[int, int, int]:
    profiles = db.query(CompanyProfile).all()
    affected = 0
    recalculated = 0
    changed = 0

    for profile in profiles:
        codes = extract_cnae_codes(profile.cnaes_principal, profile.cnaes_secundarios)
        if cnae_code not in codes:
            continue
        affected += 1
        result = recalculate_company_score(db, profile.org_id, profile.company_id)
        if result.get("updated"):
            recalculated += 1
        if result.get("changed"):
            changed += 1
    return affected, recalculated, changed


def approve_and_apply_suggestion(
    db: Session,
    *,
    org_id: str,
    suggestion_id: str,
    reviewer_user_id: str,
) -> tuple[CNAERiskSuggestion, bool, int, int, int]:
    suggestion = _get_suggestion_or_404(db, org_id, suggestion_id)
    if suggestion.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only PENDING suggestions can be approved",
        )

    suggestion.status = "APPROVED"
    suggestion.reviewed_by = reviewer_user_id
    suggestion.reviewed_at = datetime.now(timezone.utc)
    db.add(suggestion)
    db.flush()

    applied = _apply_suggestion_to_catalog(db, suggestion)
    affected, recalculated, changed = _recalculate_affected_companies(db, suggestion.cnae_code)

    suggestion.status = "APPLIED"
    db.add(suggestion)
    db.flush()

    record_audit_event(
        AuditEvent(
            action="CNAE_RISK_SUGGESTION_APPLIED",
            entity="cnae_risk_suggestions",
            entity_id=suggestion.id,
            actor_id=reviewer_user_id,
        )
    )
    return suggestion, applied, affected, recalculated, changed
