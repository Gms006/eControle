from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import and_


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.models.company_profile import CompanyProfile  # noqa: E402
from app.services.company_scoring import recalculate_company_score  # noqa: E402


def _load_targets(org_id: str | None, limit: int | None) -> list[tuple[str, str]]:
    db = SessionLocal()
    try:
        query = db.query(CompanyProfile.org_id, CompanyProfile.company_id).filter(
            and_(CompanyProfile.org_id.is_not(None), CompanyProfile.company_id.is_not(None))
        )
        if org_id:
            query = query.filter(CompanyProfile.org_id == org_id)
        query = query.order_by(CompanyProfile.org_id.asc(), CompanyProfile.company_id.asc())
        if limit is not None:
            query = query.limit(limit)
        return [(str(item[0]), str(item[1])) for item in query.all()]
    finally:
        db.close()


def run_backfill(
    *,
    org_id: str | None,
    limit: int | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    targets = _load_targets(org_id=org_id, limit=limit)
    total_read = len(targets)
    processed = 0
    success = 0
    failures = 0
    pending_batch = 0

    print(
        f"[backfill_company_scores] inicio total={total_read} "
        f"org_id={org_id or '-'} limit={limit if limit is not None else '-'} "
        f"batch_size={batch_size} dry_run={dry_run}"
    )

    db = SessionLocal()
    try:
        for target_org_id, target_company_id in targets:
            processed += 1
            try:
                if dry_run:
                    nested_tx = db.begin_nested()
                    try:
                        recalculate_company_score(db, target_org_id, target_company_id)
                    finally:
                        nested_tx.rollback()
                else:
                    with db.begin_nested():
                        recalculate_company_score(db, target_org_id, target_company_id)
                    pending_batch += 1
                success += 1
            except Exception as exc:
                failures += 1
                print(
                    f"[backfill_company_scores] erro org_id={target_org_id} "
                    f"company_id={target_company_id} detalhe={exc}"
                )

            if not dry_run and pending_batch >= batch_size:
                db.commit()
                print(
                    f"[backfill_company_scores] commit batch processados={processed} "
                    f"sucesso={success} falhas={failures}"
                )
                pending_batch = 0

        if dry_run:
            db.rollback()
        elif pending_batch > 0:
            db.commit()
            print(
                f"[backfill_company_scores] commit final processados={processed} "
                f"sucesso={success} falhas={failures}"
            )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(
        f"[backfill_company_scores] resumo total_lido={total_read} "
        f"processados={processed} sucesso={success} falhas={failures}"
    )
    return 0 if failures == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill one-shot dos snapshots de score em company_profiles."
    )
    parser.add_argument("--org-id", help="Filtra por org_id (opcional).")
    parser.add_argument(
        "--limit",
        type=int,
        help="Limita a quantidade de company_profiles processados (opcional).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Quantidade de empresas por commit em modo normal (default: 100).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Executa sem persistir alterações no banco.",
    )
    args = parser.parse_args()

    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit deve ser maior que zero quando informado.")
    if args.batch_size <= 0:
        raise ValueError("--batch-size deve ser maior que zero.")

    return run_backfill(
        org_id=args.org_id,
        limit=args.limit,
        batch_size=args.batch_size,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    raise SystemExit(main())
