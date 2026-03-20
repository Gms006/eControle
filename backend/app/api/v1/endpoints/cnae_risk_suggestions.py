from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.user import User
from app.schemas.cnae_risk_suggestion import (
    CNAERiskSuggestionApproveOut,
    CNAERiskSuggestionCreate,
    CNAERiskSuggestionOut,
    CNAERiskSuggestionRejectRequest,
    CNAERiskSuggestionUpdate,
)
from app.services.cnae_risk_suggestions import (
    approve_and_apply_suggestion,
    create_suggestion,
    list_suggestions,
    reject_suggestion,
    update_pending_suggestion,
)


router = APIRouter()


@router.get("", response_model=list[CNAERiskSuggestionOut])
def list_cnae_risk_suggestions(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[CNAERiskSuggestionOut]:
    suggestions = list_suggestions(
        db,
        org.id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return [CNAERiskSuggestionOut.model_validate(item) for item in suggestions]


@router.post("", response_model=CNAERiskSuggestionOut, status_code=status.HTTP_201_CREATED)
def create_cnae_risk_suggestion(
    payload: CNAERiskSuggestionCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> CNAERiskSuggestionOut:
    try:
        suggestion = create_suggestion(db, org_id=org.id, payload=payload.model_dump())
        db.commit()
        db.refresh(suggestion)
        return CNAERiskSuggestionOut.model_validate(suggestion)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.patch("/{suggestion_id}", response_model=CNAERiskSuggestionOut)
def patch_cnae_risk_suggestion(
    suggestion_id: str,
    payload: CNAERiskSuggestionUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> CNAERiskSuggestionOut:
    try:
        suggestion = update_pending_suggestion(
            db,
            org_id=org.id,
            suggestion_id=suggestion_id,
            payload=payload.model_dump(exclude_unset=True),
        )
        db.commit()
        db.refresh(suggestion)
        return CNAERiskSuggestionOut.model_validate(suggestion)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/{suggestion_id}/approve", response_model=CNAERiskSuggestionApproveOut)
def approve_cnae_risk_suggestion(
    suggestion_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> CNAERiskSuggestionApproveOut:
    try:
        suggestion, applied, affected, recalculated, changed = approve_and_apply_suggestion(
            db,
            org_id=org.id,
            suggestion_id=suggestion_id,
            reviewer_user_id=user.id,
        )
        db.commit()
        db.refresh(suggestion)
        return CNAERiskSuggestionApproveOut(
            suggestion=CNAERiskSuggestionOut.model_validate(suggestion),
            applied_to_catalog=applied,
            affected_companies=affected,
            recalculated_companies=recalculated,
            changed_companies=changed,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/{suggestion_id}/reject", response_model=CNAERiskSuggestionOut)
def reject_cnae_risk_suggestion(
    suggestion_id: str,
    payload: CNAERiskSuggestionRejectRequest,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> CNAERiskSuggestionOut:
    try:
        suggestion = reject_suggestion(
            db,
            org_id=org.id,
            suggestion_id=suggestion_id,
            reviewer_user_id=user.id,
            evidence_excerpt=payload.evidence_excerpt,
        )
        db.commit()
        db.refresh(suggestion)
        return CNAERiskSuggestionOut.model_validate(suggestion)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
