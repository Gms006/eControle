from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.models.licence_scan_run import LicenceScanRun
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.models.tax_portal_sync_run import TaxPortalSyncRun
from app.schemas.worker import WorkerHealthResponse, WorkerJobStatusResponse


router = APIRouter(prefix="/worker", tags=["worker"])


@router.get("/health", response_model=WorkerHealthResponse)
def worker_health(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> WorkerHealthResponse:
    db.execute(text("SELECT 1"))

    active_receitaws = (
        db.query(ReceitaWSBulkSyncRun)
        .filter(
            ReceitaWSBulkSyncRun.org_id == org.id,
            ReceitaWSBulkSyncRun.status.in_(["queued", "running"]),
        )
        .count()
    )
    active_licence_scan_full = (
        db.query(LicenceScanRun)
        .filter(
            LicenceScanRun.org_id == org.id,
            LicenceScanRun.status.in_(["queued", "running"]),
        )
        .count()
    )
    active_tax_portal = (
        db.query(TaxPortalSyncRun)
        .filter(
            TaxPortalSyncRun.org_id == org.id,
            TaxPortalSyncRun.status.in_(["queued", "running"]),
        )
        .count()
    )

    last_receitaws_started_at = (
        db.query(func.max(ReceitaWSBulkSyncRun.started_at))
        .filter(ReceitaWSBulkSyncRun.org_id == org.id)
        .scalar()
    )
    last_licence_started_at = (
        db.query(func.max(LicenceScanRun.started_at))
        .filter(LicenceScanRun.org_id == org.id)
        .scalar()
    )
    last_tax_portal_started_at = (
        db.query(func.max(TaxPortalSyncRun.started_at))
        .filter(TaxPortalSyncRun.org_id == org.id)
        .scalar()
    )

    last_job_started_at = max(
        [
            value
            for value in [
                last_receitaws_started_at,
                last_licence_started_at,
                last_tax_portal_started_at,
            ]
            if value is not None
        ],
        default=None,
    )

    return WorkerHealthResponse(
        status="ok",
        db="ok",
        backend="fastapi-background-tasks",
        jobs_supported=["receitaws_bulk_sync", "licence_scan_full", "tax_portal_sync"],
        watchers_supported=["licence_directory_watcher"],
        active_jobs=active_receitaws + active_licence_scan_full + active_tax_portal,
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
    if run:
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

    tax_run = (
        db.query(TaxPortalSyncRun)
        .filter(
            TaxPortalSyncRun.id == job_id,
            TaxPortalSyncRun.org_id == org.id,
        )
        .first()
    )
    if tax_run:
        return WorkerJobStatusResponse(
            job_id=tax_run.id,
            job_type="tax_portal_sync",
            source="tax_portal_sync_runs",
            status=tax_run.status,
            total=int(tax_run.total or 0),
            processed=int(tax_run.processed or 0),
            ok_count=int(tax_run.ok_count or 0),
            error_count=int(tax_run.error_count or 0),
            skipped_count=int(tax_run.skipped_count or 0),
            current_cnpj=tax_run.current_cnpj,
            current_company_id=tax_run.current_company_id,
            started_at=tax_run.started_at,
            finished_at=tax_run.finished_at,
            errors=list(tax_run.errors or [])[-5:],
            meta={
                "dry_run": bool(tax_run.dry_run),
                "trigger_type": tax_run.trigger_type,
                "municipio": tax_run.municipio,
                "limit": tax_run.limit,
                "relogin_count": int(tax_run.relogin_count or 0),
                "summary": tax_run.summary or {},
                "started_by_user_id": tax_run.started_by_user_id,
            },
        )

    licence_run = (
        db.query(LicenceScanRun)
        .filter(
            LicenceScanRun.id == job_id,
            LicenceScanRun.org_id == org.id,
        )
        .first()
    )
    if not licence_run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    errors = []
    if licence_run.last_error:
        errors.append({"error": licence_run.last_error})
    return WorkerJobStatusResponse(
        job_id=licence_run.id,
        job_type="licence_scan_full",
        source="licence_scan_runs",
        status=licence_run.status,
        total=int(licence_run.total or 0),
        processed=int(licence_run.processed or 0),
        ok_count=int(licence_run.ok_count or 0),
        error_count=int(licence_run.error_count or 0),
        skipped_count=0,
        current_cnpj=None,
        current_company_id=None,
        started_at=licence_run.started_at,
        finished_at=licence_run.finished_at,
        errors=errors,
        meta={},
    )