from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.normalization import normalize_process_situacao
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.notification_event import NotificationEvent
from app.models.notification_operational_scan_run import NotificationOperationalScanRun
from app.services.business_days import business_days_between
from app.services.notifications import emit_org_notification


LICENCE_RULES = (
    {
        "code": "LIC_BOMBEIROS_BD5",
        "label": "CERCON/Bombeiros",
        "valid_until_field": "cercon_valid_until",
        "window": 5,
        "window_type": "business",
    },
    {
        "code": "LIC_ALVARA_D30",
        "label": "Alvara de funcionamento",
        "valid_until_field": "alvara_funcionamento_valid_until",
        "window": 30,
        "window_type": "calendar",
    },
    {
        "code": "LIC_SANITARIO_D30",
        "label": "Alvara Sanitario",
        "valid_until_field": "alvara_vig_sanitaria_valid_until",
        "window": 30,
        "window_type": "calendar",
    },
    {
        "code": "LIC_AMBIENTAL_BD30",
        "label": "Licenca Ambiental",
        "valid_until_field": "licenca_ambiental_valid_until",
        "window": 30,
        "window_type": "business",
    },
)

PROCESS_RULES = (
    {"code": "PROC_STALE_BD7", "window": 7},
    {"code": "PROC_STALE_BD15", "window": 15},
)
TERMINAL_PROCESS_STATUS = {"indeferido", "concluido", "licenciado", "cancelado"}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_process_fallback_date(value: str | None) -> date | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    # ISO date
    try:
        return date.fromisoformat(raw[:10])
    except Exception:
        pass

    # BR format dd/mm/yyyy
    if "/" in raw:
        parts = raw.split("/")
        if len(parts) == 3:
            try:
                day = int(parts[0])
                month = int(parts[1])
                year = int(parts[2])
                return date(year, month, day)
            except Exception:
                return None
    return None


def _already_emitted(db: Session, org_id: str, dedupe_key: str) -> bool:
    existing = (
        db.query(NotificationEvent.id)
        .filter(NotificationEvent.org_id == org_id, NotificationEvent.dedupe_key == dedupe_key)
        .first()
    )
    return existing is not None


def run_notification_operational_scan(
    db: Session,
    *,
    org_id: str,
    base_date: date | None = None,
) -> dict[str, int]:
    today = base_date or _now_utc().date()
    emitted_count = 0
    deduped_count = 0
    processed = 0

    licence_rows = (
        db.query(CompanyLicence, Company)
        .outerjoin(
            Company,
            (Company.id == CompanyLicence.company_id) & (Company.org_id == CompanyLicence.org_id),
        )
        .filter(CompanyLicence.org_id == org_id)
        .all()
    )
    for licence, company in licence_rows:
        processed += 1
        company_label = (company.razao_social if company else None) or f"empresa {licence.company_id}"
        for rule in LICENCE_RULES:
            due_date = getattr(licence, rule["valid_until_field"])
            if not isinstance(due_date, date):
                continue

            if rule["window_type"] == "business":
                remaining = business_days_between(today, due_date)
            else:
                remaining = (due_date - today).days

            if remaining < 0 or remaining > int(rule["window"]):
                continue

            dedupe_key = (
                f"notif:{org_id}:{licence.id}:{rule['code']}:{due_date.isoformat()}:W{int(rule['window'])}"
            )
            if _already_emitted(db, org_id, dedupe_key):
                deduped_count += 1
                continue

            severity = "warning" if remaining <= 5 else "info"
            emit_org_notification(
                db,
                org_id=org_id,
                event_type="operational.licence.renewal",
                severity=severity,
                title=f"{rule['label']} proximo do vencimento",
                message=(
                    f"{company_label}: {rule['label']} vence em {remaining} dia(s). "
                    f"Vencimento em {due_date.isoformat()}."
                ),
                dedupe_key=dedupe_key,
                entity_type="company_licence",
                entity_id=licence.id,
                route_path="/painel?tab=licencas",
                metadata_json={
                    "rule_code": rule["code"],
                    "window": int(rule["window"]),
                    "window_type": rule["window_type"],
                    "due_date": due_date.isoformat(),
                    "days_remaining": int(remaining),
                    "company_id": licence.company_id,
                },
                commit=False,
            )
            emitted_count += 1

    process_rows = (
        db.query(CompanyProcess, Company)
        .outerjoin(
            Company,
            (Company.id == CompanyProcess.company_id) & (Company.org_id == CompanyProcess.org_id),
        )
        .filter(CompanyProcess.org_id == org_id)
        .all()
    )
    for process, company in process_rows:
        processed += 1
        process_status = normalize_process_situacao(process.situacao, strict=False)
        if process_status in TERMINAL_PROCESS_STATUS:
            continue

        last_ref_date = None
        if process.updated_at is not None:
            last_ref_date = process.updated_at.date()
        if last_ref_date is None:
            last_ref_date = _parse_process_fallback_date(process.data_solicitacao)
        if last_ref_date is None:
            continue

        stale_business_days = business_days_between(last_ref_date, today)
        if stale_business_days < 0:
            continue

        company_label = (company.razao_social if company else None) or "empresa nao vinculada"
        for rule in PROCESS_RULES:
            threshold = int(rule["window"])
            if stale_business_days < threshold:
                continue

            dedupe_key = f"notif:{org_id}:{process.id}:{rule['code']}:{last_ref_date.isoformat()}"
            if _already_emitted(db, org_id, dedupe_key):
                deduped_count += 1
                continue

            severity = "error" if threshold >= 15 else "warning"
            emit_org_notification(
                db,
                org_id=org_id,
                event_type="operational.process.stale",
                severity=severity,
                title=f"Processo sem atualizacao ({threshold} dias uteis)",
                message=(
                    f"{company_label}: processo {process.process_type} / protocolo {process.protocolo} "
                    f"esta ha {stale_business_days} dias uteis sem atualizacao."
                ),
                dedupe_key=dedupe_key,
                entity_type="company_process",
                entity_id=process.id,
                route_path="/painel?tab=processos",
                metadata_json={
                    "rule_code": rule["code"],
                    "threshold_business_days": threshold,
                    "stale_business_days": stale_business_days,
                    "reference_date": last_ref_date.isoformat(),
                    "process_id": process.id,
                },
                commit=False,
            )
            emitted_count += 1

    db.commit()
    total = len(licence_rows) + len(process_rows)
    return {
        "total": int(total),
        "processed": int(processed),
        "emitted_count": int(emitted_count),
        "deduped_count": int(deduped_count),
        "error_count": 0,
    }


def run_notification_operational_scan_job(run_id: str) -> None:
    db = SessionLocal()
    try:
        run = db.query(NotificationOperationalScanRun).filter(NotificationOperationalScanRun.id == run_id).first()
        if not run:
            return

        run.status = "running"
        run.started_at = _now_utc()
        run.finished_at = None
        run.last_error = None
        db.commit()

        summary = run_notification_operational_scan(db, org_id=run.org_id)
        run = db.query(NotificationOperationalScanRun).filter(NotificationOperationalScanRun.id == run_id).first()
        if not run:
            return
        run.status = "completed"
        run.total = int(summary["total"])
        run.processed = int(summary["processed"])
        run.emitted_count = int(summary["emitted_count"])
        run.deduped_count = int(summary["deduped_count"])
        run.error_count = int(summary["error_count"])
        run.finished_at = _now_utc()
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.query(NotificationOperationalScanRun).filter(NotificationOperationalScanRun.id == run_id).first()
        if run:
            run.status = "failed"
            run.error_count = int(run.error_count or 0) + 1
            run.last_error = str(exc)[:800]
            run.finished_at = _now_utc()
            db.commit()
    finally:
        db.close()
