from __future__ import annotations

import argparse
import logging
import time
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.licence_file_event import LicenceFileEvent
from app.services.licence_detection import (
    LicenceSuggestion,
    compare_suggestions_for_same_group,
    parse_filename_to_suggestion,
)
from app.services.licence_fs_paths import resolve_target_dir
from app.services.licence_files import (
    is_safe_fs_dirname,
    sha256_bytes,
)
from app.services.company_scoring import recalculate_company_score


logger = logging.getLogger("app.worker.watchers")
LICENCES_SUBDIR = Path("Societário") / "Alvarás e Certidões"


def _rank_candidate(source_kind: str, expiry_date: date | None) -> tuple[int, int]:
    if source_kind == "definitivo":
        return (2, 0)
    if source_kind == "dated":
        return (1, expiry_date.toordinal() if expiry_date else 0)
    return (0, 0)


def _parse_raw_date(value: str | None) -> date | None:
    try:
        return datetime.strptime(str(value or ""), "%Y-%m-%d").date()
    except ValueError:
        return None


def _upsert_licence_projection(
    db: Session,
    *,
    company: Company,
    licence_field: str,
    expiry_iso: str | None,
    source_kind: str,
    source_label: str,
    source_filename: str,
    source_document_kind: str | None = None,
    source_group: str | None = None,
) -> bool:
    row = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.org_id == company.org_id, CompanyLicence.company_id == company.id)
        .first()
    )
    if not row:
        row = CompanyLicence(org_id=company.org_id, company_id=company.id, municipio=company.municipio, raw={})
        db.add(row)

    raw = dict(row.raw) if isinstance(row.raw, dict) else {}
    current_kind = str(raw.get(f"source_kind_{licence_field}") or "").strip().lower()
    current_expiry = _parse_raw_date(raw.get(f"validade_{licence_field}"))
    if _rank_candidate(source_kind, _parse_raw_date(expiry_iso)) < _rank_candidate(current_kind, current_expiry):
        return False

    next_valid_until = _parse_raw_date(expiry_iso)
    status_value = "definitivo" if source_kind == "definitivo" else "possui"
    current_status = getattr(row, licence_field)
    current_valid_until = getattr(row, f"{licence_field}_valid_until")
    changed = current_status != status_value or current_valid_until != next_valid_until

    setattr(row, licence_field, status_value)
    setattr(row, f"{licence_field}_valid_until", next_valid_until)
    if expiry_iso:
        next_validade_br = datetime.strptime(expiry_iso, "%Y-%m-%d").strftime("%d/%m/%Y")
        if raw.get(f"validade_{licence_field}") != expiry_iso:
            changed = True
        if raw.get(f"validade_{licence_field}_br") != next_validade_br:
            changed = True
        raw[f"validade_{licence_field}"] = expiry_iso
        raw[f"validade_{licence_field}_br"] = next_validade_br
    else:
        if raw.get(f"validade_{licence_field}") is not None:
            changed = True
        if raw.get(f"validade_{licence_field}_br") is not None:
            changed = True
        raw[f"validade_{licence_field}"] = None
        raw[f"validade_{licence_field}_br"] = None
    if raw.get(f"source_kind_{licence_field}") != source_kind:
        changed = True
    if raw.get(f"source_label_{licence_field}") != source_label:
        changed = True
    if raw.get(f"source_filename_{licence_field}") != source_filename:
        changed = True
    raw[f"source_kind_{licence_field}"] = source_kind
    raw[f"source_label_{licence_field}"] = source_label
    raw[f"source_filename_{licence_field}"] = source_filename
    if source_document_kind:
        if raw.get(f"source_document_kind_{licence_field}") != source_document_kind:
            changed = True
        raw[f"source_document_kind_{licence_field}"] = source_document_kind
    if source_group:
        if raw.get(f"source_group_{licence_field}") != source_group:
            changed = True
        raw[f"source_group_{licence_field}"] = source_group
    row.raw = raw
    return changed


def process_company_licence_dir(db: Session, company: Company, root_dir: Path) -> dict[str, int]:
    stats = {"processed": 0, "skipped": 0, "errors": 0}
    if not is_safe_fs_dirname(company.fs_dirname):
        return stats

    base_dir = (root_dir / str(company.fs_dirname) / LICENCES_SUBDIR).resolve()
    try:
        base_dir.relative_to(root_dir)
    except ValueError:
        return stats
    if not base_dir.exists() or not base_dir.is_dir():
        return stats
    resolution = resolve_target_dir(base_dir, municipio=company.municipio, cnpj=company.cnpj)
    if resolution.target_dir is None:
        logger.warning(
            "watcher_target_dir_missing org_id=%s company_id=%s fs_dirname=%s warning=%s",
            company.org_id,
            company.id,
            company.fs_dirname,
            resolution.warning,
        )
        return stats
    target_dir = resolution.target_dir
    if not target_dir.exists() or not target_dir.is_dir():
        return stats

    best_by_group: dict[str, tuple[LicenceSuggestion, str]] = {}
    for file_path in target_dir.iterdir():
        if not file_path.is_file():
            continue
        filename = file_path.name
        if filename.lower().endswith(".tmp"):
            continue

        try:
            suggestion = parse_filename_to_suggestion(filename)
            if not suggestion.suggested_group or not suggestion.mapped_field or suggestion.confidence < 0.45:
                stats["skipped"] += 1
                continue
            licence_field = suggestion.mapped_field
            expiry_date = suggestion.suggested_expires_at
            content = file_path.read_bytes()
            file_hash = sha256_bytes(content)

            existing = (
                db.query(LicenceFileEvent)
                .filter(
                    LicenceFileEvent.org_id == company.org_id,
                    LicenceFileEvent.company_id == company.id,
                    LicenceFileEvent.file_hash == file_hash,
                    LicenceFileEvent.status == "processed",
                )
                .first()
            )
            if existing:
                stats["skipped"] += 1
                continue

            db.add(
                LicenceFileEvent(
                    org_id=company.org_id,
                    company_id=company.id,
                    filename=filename,
                    file_hash=file_hash,
                    detected_type=licence_field,
                    detected_expiry=expiry_date,
                    status="processed",
                    processed_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
            group_key = suggestion.suggested_group
            current_best = best_by_group.get(group_key)
            if not current_best:
                best_by_group[group_key] = (suggestion, filename)
            else:
                winner = compare_suggestions_for_same_group(current_best[0], suggestion)
                best_by_group[group_key] = (winner, filename if winner == suggestion else current_best[1])
            stats["processed"] += 1
        except Exception as exc:
            db.rollback()
            try:
                file_hash = sha256_bytes(file_path.read_bytes()) if file_path.exists() else "missing"
            except Exception:
                file_hash = "missing"
            exists_error = (
                db.query(LicenceFileEvent)
                .filter(
                    LicenceFileEvent.org_id == company.org_id,
                    LicenceFileEvent.company_id == company.id,
                    LicenceFileEvent.file_hash == file_hash,
                )
                .first()
            )
            if not exists_error:
                db.add(
                    LicenceFileEvent(
                        org_id=company.org_id,
                        company_id=company.id,
                        filename=filename,
                        file_hash=file_hash,
                        status="error",
                        error=str(exc),
                        processed_at=datetime.now(timezone.utc),
                    )
                )
                db.commit()
            stats["errors"] += 1

    if best_by_group:
        projection_changed = False
        for _group, (winner, source_filename) in best_by_group.items():
            if not winner.mapped_field:
                continue
            source_kind = "definitivo" if winner.is_definitive else "dated"
            source_label = winner.canonical_filename or winner.original_filename
            changed = _upsert_licence_projection(
                db,
                company=company,
                licence_field=winner.mapped_field,
                expiry_iso=winner.suggested_expires_at.isoformat() if winner.suggested_expires_at else None,
                source_kind=source_kind,
                source_label=source_label,
                source_filename=source_filename,
                source_document_kind=winner.suggested_document_kind,
                source_group=winner.suggested_group,
            )
            projection_changed = projection_changed or bool(changed)
        db.commit()
        if projection_changed:
            recalculate_company_score(db, company.org_id, company.id)
            db.commit()
    return stats


def run_scan_once(root_dir: str | None = None) -> dict[str, int]:
    base_root = Path(root_dir or settings.EMPRESAS_ROOT_DIR).resolve()
    db = SessionLocal()
    total = {"processed": 0, "skipped": 0, "errors": 0, "companies": 0}
    try:
        companies = db.query(Company).filter(Company.fs_dirname.is_not(None)).all()
        for company in companies:
            total["companies"] += 1
            stats = process_company_licence_dir(db, company, base_root)
            total["processed"] += stats["processed"]
            total["skipped"] += stats["skipped"]
            total["errors"] += stats["errors"]
    finally:
        db.close()
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description="Licence filesystem watcher/worker")
    parser.add_argument("--root-dir", default=None, help="Override EMPRESAS_ROOT_DIR")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval-seconds", type=int, default=15, help="Loop interval in seconds")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    if not args.loop:
        stats = run_scan_once(args.root_dir)
        logger.info("watcher_scan_once companies=%s processed=%s skipped=%s errors=%s", stats["companies"], stats["processed"], stats["skipped"], stats["errors"])
        return 0

    logger.info("watcher_loop_started interval_seconds=%s", args.interval_seconds)
    while True:
        stats = run_scan_once(args.root_dir)
        logger.info(
            "watcher_scan_loop companies=%s processed=%s skipped=%s errors=%s",
            stats["companies"],
            stats["processed"],
            stats["skipped"],
            stats["errors"],
        )
        time.sleep(max(args.interval_seconds, 2))


if __name__ == "__main__":
    raise SystemExit(main())
