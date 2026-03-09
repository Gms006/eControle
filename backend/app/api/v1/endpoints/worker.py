from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.schemas.worker import WorkerHealthResponse, WorkerJobStatusResponse


router = APIRouter(prefix="/worker", tags=["worker"])


@router.get("/health", response_model=WorkerHealthResponse)
def worker_health(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> WorkerHealthResponse:
    # Verifica conectividade básica com o banco.
    db.execute(text("SELECT 1"))

    active_jobs = (
        db.query(ReceitaWSBulkSyncRun)
        .filter(
            ReceitaWSBulkSyncRun.org_id == org.id,
            ReceitaWSBulkSyncRun.status.in_(["queued", "running"]),
        )
        .count()
    )
    last_job_started_at = (
        db.query(func.max(ReceitaWSBulkSyncRun.started_at))
        .filter(ReceitaWSBulkSyncRun.org_id == org.id)
        .scalar()
    )

    return WorkerHealthResponse(
        status="ok",
        db="ok",
        backend="fastapi-background-tasks",
        jobs_supported=["receitaws_bulk_sync"],
        watchers_supported=["licence_directory_watcher"],
        active_jobs=active_jobs,
        last_job_started_at=last_job_started_at,
    )


@router.get("/jobs/{job_id}", response_model=WorkerJobStatusResponse)
def worker_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> WorkerJobStatusResponse:
    run = (
        db.query(ReceitaWSBulkSyncRun)
        .filter(
            ReceitaWSBulkSyncRun.id == job_id,
            ReceitaWSBulkSyncRun.org_id == org.id,
        )
        .first()
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return WorkerJobStatusResponse(
        job_id=run.id,
        job_type="receitaws_bulk_sync",
        source="receitaws_bulk_sync_runs",
        status=run.status,
        total=int(run.total or 0),
        processed=int(run.processed or 0),
        ok_count=int(run.ok_count or 0),
        error_count=int(run.error_count or 0),
        skipped_count=int(run.skipped_count or 0),
        current_cnpj=run.current_cnpj,
        current_company_id=run.current_company_id,
        started_at=run.started_at,
        finished_at=run.finished_at,
        errors=list(run.errors or [])[-5:],
        meta={
            "dry_run": bool(run.dry_run),
            "only_missing": bool(run.only_missing),
            "started_by_user_id": run.started_by_user_id,
            "changes_summary": run.changes_summary or {},
        },
    )
