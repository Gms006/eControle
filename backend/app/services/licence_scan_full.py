from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.licence_scan_run import LicenceScanRun
from app.services.notifications import emit_org_notification
from app.worker.watchers import process_company_licence_dir


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _emit_scan_notification(run: LicenceScanRun, db) -> None:
    severity = "warning" if run.status == "error" else "info"
    title = "Scan de licencas finalizado" if run.status != "error" else "Scan de licencas com falha"
    message = (
        f"Run {run.id} finalizada com status {run.status}. "
        f"Processadas {int(run.processed or 0)}/{int(run.total or 0)} empresas. "
        f"OK={int(run.ok_count or 0)} Erros={int(run.error_count or 0)}."
    )
    emit_org_notification(
        db,
        org_id=run.org_id,
        event_type="job.licence_scan_full.finished",
        severity=severity,
        title=title,
        message=message,
        dedupe_key=f"job:licence_scan_full:{run.id}:{run.status}",
        entity_type="licence_scan_run",
        entity_id=run.id,
        route_path="/painel?tab=licencas",
        metadata_json={
            "run_id": run.id,
            "status": run.status,
            "total": int(run.total or 0),
            "processed": int(run.processed or 0),
            "ok_count": int(run.ok_count or 0),
            "error_count": int(run.error_count or 0),
        },
        commit=False,
    )


def run_licence_scan_full_job(run_id: str, root_dir: str | None = None) -> None:
    db = SessionLocal()
    try:
        run = db.query(LicenceScanRun).filter(LicenceScanRun.id == run_id).first()
        if not run:
            return

        companies = (
            db.query(Company)
            .filter(Company.org_id == run.org_id, Company.fs_dirname.is_not(None))
            .order_by(Company.created_at.asc())
            .all()
        )
        run.status = "running"
        run.total = len(companies)
        run.processed = 0
        run.ok_count = 0
        run.error_count = 0
        run.started_at = _now_utc()
        run.finished_at = None
        run.last_error = None
        db.commit()

        base_root = Path(root_dir or settings.EMPRESAS_ROOT_DIR).resolve()
        for index, company in enumerate(companies):
            try:
                stats = process_company_licence_dir(db, company, base_root)
                if int(stats.get("errors", 0) or 0) > 0:
                    run.error_count = int(run.error_count or 0) + 1
                else:
                    run.ok_count = int(run.ok_count or 0) + 1
            except Exception as exc:
                db.rollback()
                run = db.query(LicenceScanRun).filter(LicenceScanRun.id == run_id).first()
                if not run:
                    return
                run.error_count = int(run.error_count or 0) + 1
                run.last_error = str(exc)[:800]
            finally:
                run.processed = index + 1
                db.commit()

        run = db.query(LicenceScanRun).filter(LicenceScanRun.id == run_id).first()
        if not run:
            return
        run.status = "error" if int(run.error_count or 0) > 0 and int(run.ok_count or 0) == 0 else "done"
        run.finished_at = _now_utc()
        _emit_scan_notification(run, db)
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.query(LicenceScanRun).filter(LicenceScanRun.id == run_id).first()
        if run:
            run.status = "error"
            run.finished_at = _now_utc()
            run.last_error = str(exc)[:800]
            _emit_scan_notification(run, db)
            db.commit()
    finally:
        db.close()
