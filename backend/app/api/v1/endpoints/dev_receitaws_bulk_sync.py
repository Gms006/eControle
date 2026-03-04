from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles, verify_password
from app.db.session import get_db
from app.models.org import Org
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.models.user import User
from app.schemas.receitaws_bulk_sync import (
    ReceitaWSBulkSyncCancelResponse,
    ReceitaWSBulkSyncStartRequest,
    ReceitaWSBulkSyncStartResponse,
    ReceitaWSBulkSyncStatusResponse,
)
from app.services.receitaws_bulk_sync import run_receitaws_bulk_sync_job


router = APIRouter()


def _get_run_or_404(db: Session, org_id: str, run_id: str) -> ReceitaWSBulkSyncRun:
    run = (
        db.query(ReceitaWSBulkSyncRun)
        .filter(ReceitaWSBulkSyncRun.id == run_id, ReceitaWSBulkSyncRun.org_id == org_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def _get_active_run(db: Session, org_id: str) -> ReceitaWSBulkSyncRun | None:
    return (
        db.query(ReceitaWSBulkSyncRun)
        .filter(
            ReceitaWSBulkSyncRun.org_id == org_id,
            ReceitaWSBulkSyncRun.status.in_(["queued", "running"]),
        )
        .order_by(ReceitaWSBulkSyncRun.started_at.desc())
        .first()
    )


@router.post("/receitaws/bulk-sync/start", response_model=ReceitaWSBulkSyncStartResponse)
def start_receitaws_bulk_sync(
    payload: ReceitaWSBulkSyncStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("DEV")),
) -> ReceitaWSBulkSyncStartResponse:
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    active_run = _get_active_run(db, org.id)
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "There is already an active run", "run_id": active_run.id},
        )

    run = ReceitaWSBulkSyncRun(
        org_id=org.id,
        started_by_user_id=user.id,
        status="queued",
        dry_run=payload.dry_run,
        only_missing=payload.only_missing,
        total=0,
        processed=0,
        ok_count=0,
        error_count=0,
        skipped_count=0,
        errors=[],
        changes_summary={"field_counters": {}, "sample_changes": [], "companies_with_changes": 0},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(run_receitaws_bulk_sync_job, run.id)
    return ReceitaWSBulkSyncStartResponse(run_id=run.id)


@router.get("/receitaws/bulk-sync/active", response_model=ReceitaWSBulkSyncStartResponse)
def get_active_receitaws_bulk_sync_run(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("DEV")),
) -> ReceitaWSBulkSyncStartResponse:
    active_run = _get_active_run(db, org.id)
    if not active_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active run")
    return ReceitaWSBulkSyncStartResponse(run_id=active_run.id)


@router.get("/receitaws/bulk-sync/{run_id}", response_model=ReceitaWSBulkSyncStatusResponse)
def get_receitaws_bulk_sync_status(
    run_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("DEV")),
) -> ReceitaWSBulkSyncStatusResponse:
    run = _get_run_or_404(db, org.id, run_id)
    return ReceitaWSBulkSyncStatusResponse(
        run_id=run.id,
        org_id=run.org_id,
        started_by_user_id=run.started_by_user_id,
        status=run.status,
        dry_run=run.dry_run,
        only_missing=run.only_missing,
        total=run.total,
        processed=run.processed,
        ok_count=run.ok_count,
        error_count=run.error_count,
        skipped_count=run.skipped_count,
        current_cnpj=run.current_cnpj,
        current_company_id=run.current_company_id,
        started_at=run.started_at,
        finished_at=run.finished_at,
        errors=list(run.errors or [])[-5:],
        changes_summary=run.changes_summary or {},
    )


@router.post("/receitaws/bulk-sync/{run_id}/cancel", response_model=ReceitaWSBulkSyncCancelResponse)
def cancel_receitaws_bulk_sync(
    run_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user: User = Depends(require_roles("DEV")),
) -> ReceitaWSBulkSyncCancelResponse:
    run = _get_run_or_404(db, org.id, run_id)
    if run.status in {"completed", "failed", "cancelled"}:
        return ReceitaWSBulkSyncCancelResponse(run_id=run.id, status=run.status)
    run.status = "cancelled"
    db.commit()
    return ReceitaWSBulkSyncCancelResponse(run_id=run.id, status=run.status)
