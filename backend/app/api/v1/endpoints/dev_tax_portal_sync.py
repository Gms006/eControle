from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles, verify_password
from app.db.session import get_db
from app.models.org import Org
from app.models.tax_portal_sync_run import TaxPortalSyncRun
from app.models.user import User
from app.schemas.tax_portal_sync import (
    TaxPortalSyncCancelResponse,
    TaxPortalSyncStartRequest,
    TaxPortalSyncStartResponse,
    TaxPortalSyncStatusResponse,
)
from app.services.tax_portal_sync import run_tax_portal_sync_job


router = APIRouter()


def _get_run_or_404(db: Session, org_id: str, run_id: str) -> TaxPortalSyncRun:
    run = (
        db.query(TaxPortalSyncRun)
        .filter(TaxPortalSyncRun.id == run_id, TaxPortalSyncRun.org_id == org_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def _get_active_run(db: Session, org_id: str) -> TaxPortalSyncRun | None:
    return (
        db.query(TaxPortalSyncRun)
        .filter(
            TaxPortalSyncRun.org_id == org_id,
            TaxPortalSyncRun.status.in_(["queued", "running"]),
        )
        .order_by(TaxPortalSyncRun.started_at.desc())
        .first()
    )


@router.post("/taxas/portal-sync/start", response_model=TaxPortalSyncStartResponse)
def start_tax_portal_sync(
    payload: TaxPortalSyncStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> TaxPortalSyncStartResponse:
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    active_run = _get_active_run(db, org.id)
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "There is already an active run", "run_id": active_run.id},
        )

    run = TaxPortalSyncRun(
        org_id=org.id,
        started_by_user_id=user.id,
        status="queued",
        trigger_type="manual",
        dry_run=payload.dry_run,
        municipio=payload.municipio,
        limit=payload.limit,
        total=0,
        processed=0,
        ok_count=0,
        error_count=0,
        skipped_count=0,
        relogin_count=0,
        errors=[],
        summary={},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(run_tax_portal_sync_job, run.id)
    return TaxPortalSyncStartResponse(run_id=run.id)


@router.get("/taxas/portal-sync/active", response_model=TaxPortalSyncStartResponse)
def get_active_tax_portal_sync_run(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> TaxPortalSyncStartResponse:
    active_run = _get_active_run(db, org.id)
    if not active_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active run")
    return TaxPortalSyncStartResponse(run_id=active_run.id)


@router.get("/taxas/portal-sync/{run_id}", response_model=TaxPortalSyncStatusResponse)
def get_tax_portal_sync_status(
    run_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> TaxPortalSyncStatusResponse:
    run = _get_run_or_404(db, org.id, run_id)
    return TaxPortalSyncStatusResponse(
        run_id=run.id,
        org_id=run.org_id,
        started_by_user_id=run.started_by_user_id,
        status=run.status,
        trigger_type=run.trigger_type,
        dry_run=run.dry_run,
        municipio=run.municipio,
        limit=run.limit,
        total=run.total,
        processed=run.processed,
        ok_count=run.ok_count,
        error_count=run.error_count,
        skipped_count=run.skipped_count,
        relogin_count=run.relogin_count,
        current_cnpj=run.current_cnpj,
        current_company_id=run.current_company_id,
        started_at=run.started_at,
        finished_at=run.finished_at,
        errors=list(run.errors or [])[-5:],
        summary=run.summary or {},
    )


@router.post("/taxas/portal-sync/{run_id}/cancel", response_model=TaxPortalSyncCancelResponse)
def cancel_tax_portal_sync(
    run_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("ADMIN", "DEV")),
) -> TaxPortalSyncCancelResponse:
    run = _get_run_or_404(db, org.id, run_id)
    if run.status in {"completed", "failed", "cancelled"}:
        return TaxPortalSyncCancelResponse(run_id=run.id, status=run.status)

    run.status = "cancelled"
    db.commit()
    return TaxPortalSyncCancelResponse(run_id=run.id, status=run.status)