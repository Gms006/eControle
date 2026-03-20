from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.user import User
from app.schemas.official_sources import (
    OfficialSourceLookupBatchRequest,
    OfficialSourceLookupRequest,
    OfficialSourceLookupResponse,
)
from app.services.cnae_official_suggestions import (
    run_official_lookup_and_create_suggestions,
    serialize_created_suggestions,
)


router = APIRouter()


@router.post("/lookup", response_model=OfficialSourceLookupResponse)
def lookup_official_sources_for_cnae(
    payload: OfficialSourceLookupRequest,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> OfficialSourceLookupResponse:
    try:
        result = run_official_lookup_and_create_suggestions(
            db,
            org_id=org.id,
            cnae_codes=[payload.cnae_code],
            sources=payload.sources,
        )
        db.commit()
        return OfficialSourceLookupResponse(
            findings=result.findings,
            suggestions_created=serialize_created_suggestions(result.suggestions_created),
            skipped_duplicates=result.skipped_duplicates,
            source_errors=result.source_errors,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/lookup-batch", response_model=OfficialSourceLookupResponse)
def lookup_official_sources_for_cnae_batch(
    payload: OfficialSourceLookupBatchRequest,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> OfficialSourceLookupResponse:
    try:
        result = run_official_lookup_and_create_suggestions(
            db,
            org_id=org.id,
            cnae_codes=payload.cnae_codes,
            sources=payload.sources,
        )
        db.commit()
        return OfficialSourceLookupResponse(
            findings=result.findings,
            suggestions_created=serialize_created_suggestions(result.suggestions_created),
            skipped_duplicates=result.skipped_duplicates,
            source_errors=result.source_errors,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
