from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.licence_scan_run import LicenceScanRun
from app.worker.watchers import process_company_licence_dir


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


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
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.query(LicenceScanRun).filter(LicenceScanRun.id == run_id).first()
        if run:
            run.status = "error"
            run.finished_at = _now_utc()
            run.last_error = str(exc)[:800]
            db.commit()
    finally:
        db.close()
