from __future__ import annotations

import argparse
import sys

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.org import Org
from app.models.tax_portal_sync_run import TaxPortalSyncRun
from app.services.tax_portal_sync import run_tax_portal_sync_job


def main() -> int:
    parser = argparse.ArgumentParser(description="Executa uma rodada do tax_portal_sync.")
    parser.add_argument("--org-slug", required=True)
    parser.add_argument("--municipio", default=settings.TAX_PORTAL_DEFAULT_MUNICIPIO)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        org = db.query(Org).filter(Org.slug == args.org_slug).first()
        if not org:
            print(f"Org não encontrada para slug={args.org_slug}", file=sys.stderr)
            return 2

        active_run = (
            db.query(TaxPortalSyncRun)
            .filter(
                TaxPortalSyncRun.org_id == org.id,
                TaxPortalSyncRun.status.in_(["queued", "running"]),
            )
            .first()
        )
        if active_run:
            print(f"Já existe run ativa: {active_run.id}", file=sys.stderr)
            return 3

        run = TaxPortalSyncRun(
            org_id=org.id,
            started_by_user_id=None,
            status="queued",
            trigger_type="scheduled",
            dry_run=args.dry_run,
            municipio=args.municipio,
            limit=args.limit,
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
        print(f"Run criada: {run.id}")
        run_id = run.id
    finally:
        db.close()

    run_tax_portal_sync_job(run_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())