from __future__ import annotations

import asyncio
import re
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.api.v1.endpoints.lookups import fetch_receitaws_payload, map_receitaws_payload, normalize_cnpj
from app.core.cnae import normalize_cnae_list
from app.core.config import settings
from app.core.normalization import normalize_municipio, normalize_spaces, normalize_title_case
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.services.company_scoring import recalculate_company_score


MAX_ERROR_ITEMS = 50
MAX_SAMPLE_CHANGES = 10


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_cnae_code_list(items: Any) -> list[dict]:
    return normalize_cnae_list(items)


def _normalize_uf(value: Any) -> str | None:
    text = normalize_spaces(value)
    if not text:
        return None
    return text.upper()[:2]


def _is_missing_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        normalized = value.strip()
        return normalized in {"", "-", "—"}
    if isinstance(value, (list, dict)):
        return len(value) == 0
    return False


def _sanitize_change_value(value: Any) -> Any:
    if isinstance(value, str):
        text = value.strip()
        return text if len(text) <= 200 else f"{text[:197]}..."
    return value


def _normalize_payload_for_sync(cnpj: str, raw_payload: dict[str, Any]) -> dict[str, Any]:
    mapped = map_receitaws_payload(cnpj, raw_payload)
    return {
        "company.razao_social": normalize_title_case(mapped.get("razao_social")),
        "company.nome_fantasia": normalize_title_case(mapped.get("nome_fantasia")),
        "company.municipio": normalize_municipio(mapped.get("municipio")),
        "company.uf": _normalize_uf(mapped.get("uf")),
        "profile.porte": normalize_spaces(mapped.get("porte")),
        "profile.cnaes_principal": _to_cnae_code_list(mapped.get("cnaes_principal")),
        "profile.cnaes_secundarios": _to_cnae_code_list(mapped.get("cnaes_secundarios")),
        "profile.raw.mei": bool(mapped.get("simei_optante") is True),
        "profile.raw.mei_optante": bool(mapped.get("simei_optante") is True),
    }


def diff_and_apply(
    *,
    company: Company,
    profile: CompanyProfile,
    mapped_payload: dict[str, Any],
    dry_run: bool,
    only_missing: bool,
) -> dict[str, Any]:
    changes: list[dict[str, Any]] = []
    for field, after in mapped_payload.items():
        if field.startswith("company."):
            attr = field.split(".", 1)[1]
            before = getattr(company, attr)
            target = company
        elif field.startswith("profile.raw."):
            attr = field.split(".", 2)[2]
            before = (profile.raw or {}).get(attr) if isinstance(profile.raw, dict) else None
            target = profile
        else:
            attr = field.split(".", 1)[1]
            before = getattr(profile, attr)
            target = profile

        if only_missing and not _is_missing_value(before):
            continue
        if _is_missing_value(after):
            continue
        if before == after:
            continue

        changes.append(
            {
                "field": field,
                "before": _sanitize_change_value(before),
                "after": _sanitize_change_value(after),
            }
        )
        if dry_run:
            continue
        if field.startswith("profile.raw."):
            raw_data = dict(profile.raw or {})
            raw_data[attr] = after
            target.raw = raw_data
        else:
            setattr(target, attr, after)

    return {
        "applied": bool(changes),
        "skipped": not bool(changes),
        "changes": changes,
    }


def _next_sleep_seconds(base_interval: float, is_rate_limited: bool) -> float:
    extra = float(getattr(settings, "RECEITAWS_RATE_LIMIT_BACKOFF_SECONDS", 60))
    return max(0.0, base_interval + (extra if is_rate_limited else 0.0))


def _append_error(run: ReceitaWSBulkSyncRun, company: Company, message: str) -> None:
    errors = list(run.errors or [])
    errors.append(
        {
            "company_id": company.id,
            "cnpj": company.cnpj,
            "error": message[:800],
            "at": _now_utc().isoformat(),
        }
    )
    run.errors = errors[-MAX_ERROR_ITEMS:]


def _init_changes_summary(run: ReceitaWSBulkSyncRun) -> dict[str, Any]:
    base = run.changes_summary or {}
    if not isinstance(base, dict):
        base = {}
    base.setdefault("field_counters", {})
    base.setdefault("sample_changes", [])
    base.setdefault("companies_with_changes", 0)
    return base


def _merge_changes_summary(run: ReceitaWSBulkSyncRun, company: Company, changes: list[dict[str, Any]]) -> None:
    summary = _init_changes_summary(run)
    counters = Counter(summary.get("field_counters") or {})
    for item in changes:
        counters[item["field"]] += 1
    summary["field_counters"] = dict(counters)

    if changes:
        summary["companies_with_changes"] = int(summary.get("companies_with_changes", 0)) + 1

    samples = list(summary.get("sample_changes") or [])
    if len(samples) < MAX_SAMPLE_CHANGES and changes:
        samples.append(
            {
                "company_id": company.id,
                "cnpj": company.cnpj,
                "changes": changes[:5],
            }
        )
    summary["sample_changes"] = samples[:MAX_SAMPLE_CHANGES]
    run.changes_summary = summary


def _changes_affect_company_score(changes: list[dict[str, Any]]) -> bool:
    score_fields = {"profile.cnaes_principal", "profile.cnaes_secundarios"}
    return any(str(item.get("field")) in score_fields for item in changes)


def _extract_digits(cnpj: str) -> str:
    return re.sub(r"\D", "", cnpj or "")


def run_receitaws_bulk_sync_job(run_id: str) -> None:
    db: Session = SessionLocal()
    min_interval = float(getattr(settings, "RECEITAWS_MIN_INTERVAL_SECONDS", 20))
    try:
        run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        if not run:
            return

        companies = (
            db.query(Company)
            .filter(Company.org_id == run.org_id, Company.is_active.is_(True), Company.cnpj.isnot(None))
            .order_by(Company.created_at.asc())
            .all()
        )
        run.total = len(companies)
        run.status = "running"
        run.errors = run.errors or []
        run.changes_summary = _init_changes_summary(run)
        db.commit()

        for idx, company in enumerate(companies):
            db.expire_all()
            run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
            if not run:
                return
            if run.status == "cancelled":
                run.finished_at = _now_utc()
                db.commit()
                return

            run.current_company_id = company.id
            run.current_cnpj = company.cnpj
            db.commit()

            stored_profile = (
                db.query(CompanyProfile)
                .filter(CompanyProfile.org_id == run.org_id, CompanyProfile.company_id == company.id)
                .first()
            )
            profile_for_diff = stored_profile or CompanyProfile(org_id=run.org_id, company_id=company.id)

            is_rate_limited = False
            try:
                cnpj_digits = normalize_cnpj(_extract_digits(company.cnpj))
                raw_payload = asyncio.run(fetch_receitaws_payload(cnpj_digits))
                if str(raw_payload.get("status", "")).upper() != "OK":
                    raise ValueError(raw_payload.get("message") or "ReceitaWS retornou payload invalido")

                mapped_payload = _normalize_payload_for_sync(cnpj_digits, raw_payload)
                result = diff_and_apply(
                    company=company,
                    profile=profile_for_diff,
                    mapped_payload=mapped_payload,
                    dry_run=True,
                    only_missing=run.only_missing,
                )
                _merge_changes_summary(run, company, result["changes"])

                if result["skipped"]:
                    run.skipped_count = int(run.skipped_count or 0) + 1
                else:
                    run.ok_count = int(run.ok_count or 0) + 1
                if not run.dry_run and result["changes"]:
                    profile_to_apply = stored_profile
                    if profile_to_apply is None:
                        profile_to_apply = CompanyProfile(org_id=run.org_id, company_id=company.id)
                        db.add(profile_to_apply)
                        db.flush()
                    apply_result = diff_and_apply(
                        company=company,
                        profile=profile_to_apply,
                        mapped_payload=mapped_payload,
                        dry_run=False,
                        only_missing=run.only_missing,
                    )
                    if apply_result["changes"] and _changes_affect_company_score(apply_result["changes"]):
                        recalculate_company_score(db, run.org_id, company.id)
            except Exception as exc:
                message = str(exc)
                is_rate_limited = "429" in message
                db.rollback()
                run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
                if not run:
                    return
                run.error_count = int(run.error_count or 0) + 1
                _append_error(run, company, message or "Erro inesperado")
            finally:
                run.processed = idx + 1
                if idx + 1 >= len(companies):
                    run.current_cnpj = None
                    run.current_company_id = None
                db.commit()

                if idx + 1 < len(companies):
                    time.sleep(_next_sleep_seconds(min_interval, is_rate_limited))

        run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        if not run:
            return
        if run.status != "cancelled":
            run.status = "completed"
        run.finished_at = _now_utc()
        run.current_cnpj = None
        run.current_company_id = None
        db.commit()
    except Exception:
        db.rollback()
        failed_run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        if failed_run:
            failed_run.status = "failed"
            failed_run.finished_at = _now_utc()
            failed_run.current_cnpj = None
            failed_run.current_company_id = None
            errors = list(failed_run.errors or [])
            errors.append({"error": "Falha interna ao executar job", "at": _now_utc().isoformat()})
            failed_run.errors = errors[-MAX_ERROR_ITEMS:]
            db.commit()
    finally:
        db.close()
