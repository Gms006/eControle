from __future__ import annotations

import asyncio
import logging
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.models.tax_portal_sync_run import TaxPortalSyncRun
from app.services.notifications import emit_org_notification
from app.services.tax_portal_runtime import (
    PORTAL_URL,
    consultar_cnpj,
    format_cnpj_masked,
    formatar_status_para_planilha,
    load_portal_credentials,
    open_tax_portal_page,
    realizar_login,
)


logger = logging.getLogger(__name__)

MAX_ERROR_ITEMS = 50
MAX_SAMPLE_ITEMS = 10

TAX_FIELD_MAP = {
    "TAXA FUNCIONAMENTO": "taxa_funcionamento",
    "TAXA PUBLICIDADE": "taxa_publicidade",
    "TAXA VIG SANITÁRIA": "taxa_vig_sanitaria",
    "ISS": "iss",
    "TAXA LOCALIZ INSTALAÇÃO": "taxa_localiz_instalacao",
    "TAXA OCUP ÁREA PÚBLICA": "taxa_ocup_area_publica",
}

TAX_RUNTIME_NAME_MAP = {
    "Taxa de Fiscalização de Funcionamento": "TAXA FUNCIONAMENTO",
    "Taxa de Fiscalização de Meios de Publicidade em Geral": "TAXA PUBLICIDADE",
    "ISS": "ISS",
    "Taxa de Vigilância Sanitária": "TAXA VIG SANITÁRIA",
    "Taxa de Fiscalização de Localização e Instalação": "TAXA LOCALIZ INSTALAÇÃO",
    "Preço Público Pela Ocupação e Uso de Área Pública": "TAXA OCUP ÁREA PÚBLICA",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _norm(txt: str | None) -> str:
    if txt is None:
        return ""
    return (
        unicodedata.normalize("NFKD", str(txt))
        .encode("ASCII", "ignore")
        .decode()
        .upper()
        .strip()
    )


def _status_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _requires_envio(value: str | None) -> bool:
    key = _status_key(value)
    return "pendente" in key or "em_aberto" in key


def _resolve_tax_field_value(current_value: str | None, portal_value: str | None) -> str | None:
    current = str(current_value).strip() if current_value is not None else ""
    current_key = _status_key(current)

    is_non_payable = current_key in {
        "isento",
        "n_a",
        "na",
        "nao_aplicavel",
        "nao_se_aplica",
    }
    is_open_or_installment = (
        "em_aberto" in current_key
        or "ate" in current_key
        or bool(re.fullmatch(r"\d+/\d+", current_key.replace("_", "/")))
    )

    if current == "*":
        return portal_value if portal_value is not None else "*"
    if portal_value is not None:
        return portal_value
    if is_non_payable:
        return current_value
    if is_open_or_installment:
        return "Pago"
    return current_value


def _recompute_status_taxas(tax: CompanyTax) -> str:
    tracked_fields = [
        tax.taxa_funcionamento,
        tax.taxa_publicidade,
        tax.taxa_vig_sanitaria,
        tax.iss,
        tax.taxa_localiz_instalacao,
        tax.taxa_ocup_area_publica,
        tax.taxa_bombeiros,
        tax.tpi,
    ]
    return "irregular" if any(_requires_envio(value) for value in tracked_fields) else "regular"


def _extract_open_years_by_portal_label(raw_taxes: list[dict[str, Any]]) -> dict[str, list[int]]:
    by_label: dict[str, set[int]] = {}
    for item in raw_taxes or []:
        nome = str(item.get("nome") or "")
        exercicio_raw = str(item.get("exercicio") or "").strip()
        if not exercicio_raw.isdigit():
            continue
        portal_label = None
        nome_norm = _norm(nome)
        for runtime_name, label in TAX_RUNTIME_NAME_MAP.items():
            if _norm(runtime_name) in nome_norm:
                portal_label = label
                break
        if not portal_label:
            continue
        by_label.setdefault(portal_label, set()).add(int(exercicio_raw))
    return {label: sorted(list(years)) for label, years in by_label.items()}


def _append_error(run: TaxPortalSyncRun, company: Company, message: str) -> None:
    errors = list(run.errors or [])
    errors.append(
        {
            "company_id": company.id,
            "cnpj": company.cnpj,
            "error": (message or "Erro inesperado")[:800],
            "at": _now_utc().isoformat(),
        }
    )
    run.errors = errors[-MAX_ERROR_ITEMS:]


def _init_summary(run: TaxPortalSyncRun) -> dict[str, Any]:
    raw_base = run.summary if isinstance(run.summary, dict) else {}
    base: dict[str, Any] = dict(raw_base)
    base["field_counters"] = dict(raw_base.get("field_counters") or {})
    base["sample_results"] = list(raw_base.get("sample_results") or [])
    base["companies_with_debits"] = int(raw_base.get("companies_with_debits") or 0)
    base["companies_marked_paid"] = int(raw_base.get("companies_marked_paid") or 0)
    base["filtered_out_count"] = int(raw_base.get("filtered_out_count") or 0)
    return base


def _merge_summary(
    run: TaxPortalSyncRun,
    company: Company,
    *,
    changes: list[dict[str, Any]],
    has_debits: bool,
    marked_paid: bool,
) -> None:
    summary = _init_summary(run)
    counters = Counter(summary.get("field_counters") or {})
    for item in changes:
        counters[item["field"]] += 1
    summary["field_counters"] = dict(counters)

    if has_debits:
        summary["companies_with_debits"] = int(summary.get("companies_with_debits", 0)) + 1
    if marked_paid:
        summary["companies_marked_paid"] = int(summary.get("companies_marked_paid", 0)) + 1

    samples = list(summary.get("sample_results") or [])
    if len(samples) < MAX_SAMPLE_ITEMS:
        samples.append(
            {
                "company_id": company.id,
                "cnpj": company.cnpj,
                "changes_count": len(changes),
                "changes": changes[:6],
                "has_debits": has_debits,
                "marked_paid": marked_paid,
            }
        )
    summary["sample_results"] = samples[:MAX_SAMPLE_ITEMS]
    run.summary = summary


def _select_companies_for_run(db: Session, run: TaxPortalSyncRun) -> tuple[list[Company], int]:
    companies = (
        db.query(Company)
        .filter(Company.org_id == run.org_id, Company.is_active.is_(True))
        .order_by(Company.created_at.asc())
        .all()
    )

    profiles = {
        p.company_id: p
        for p in db.query(CompanyProfile).filter(CompanyProfile.org_id == run.org_id).all()
    }

    target_municipio = _norm(run.municipio or settings.TAX_PORTAL_DEFAULT_MUNICIPIO)

    selected: list[Company] = []
    filtered_out = 0

    for company in companies:
        if target_municipio and _norm(company.municipio) != target_municipio:
            filtered_out += 1
            continue

        porte = _norm(getattr(profiles.get(company.id), "porte", None))
        if porte in {"CAEPF", "PF"}:
            filtered_out += 1
            continue

        selected.append(company)

    if run.limit:
        selected = selected[: int(run.limit)]

    return selected, filtered_out


def _load_tax_row(db: Session, org_id: str, company_id: str) -> CompanyTax | None:
    return (
        db.query(CompanyTax)
        .filter(CompanyTax.org_id == org_id, CompanyTax.company_id == company_id)
        .first()
    )


def apply_tax_portal_result_to_company_tax(
    *,
    db: Session,
    org_id: str,
    company_id: str,
    run_id: str,
    portal_statuses: dict[str, str],
    raw_taxes: list[dict[str, Any]],
    persist: bool,
) -> dict[str, Any]:
    existing = _load_tax_row(db, org_id, company_id)
    tax = existing or CompanyTax(org_id=org_id, company_id=company_id)

    changes: list[dict[str, Any]] = []
    has_debits = bool(portal_statuses)

    for portal_label, model_field in TAX_FIELD_MAP.items():
        before = getattr(tax, model_field)
        portal_value = portal_statuses.get(portal_label)
        after = _resolve_tax_field_value(before, portal_value)

        if before != after:
            changes.append({"field": model_field, "before": before, "after": after})
            if persist:
                setattr(tax, model_field, after)

    if persist:
        tax.status_taxas = _recompute_status_taxas(tax)
        merged_raw = dict(tax.raw or {})
        open_years_by_label = _extract_open_years_by_portal_label(raw_taxes)
        current_year = _now_utc().year
        years_by_field: dict[str, list[int] | None] = {}
        for portal_label, model_field in TAX_FIELD_MAP.items():
            years = list(open_years_by_label.get(portal_label) or [])
            years_without_current = [year for year in years if year != current_year]
            value: list[int] | None = years_without_current if years_without_current else None
            years_by_field[model_field] = value

        merged_raw["tax_portal_sync"] = {
            "run_id": run_id,
            "synced_at": _now_utc().isoformat(),
            "source": "portal_anapolis",
            "has_debits": has_debits,
            "taxas_brutas": raw_taxes,
            "taxas_formatadas": portal_statuses,
            "anos_em_aberto_por_campo": years_by_field,
        }
        merged_raw["anos_em_aberto_por_campo"] = years_by_field
        tax.raw = merged_raw

        if existing is None:
            db.add(tax)

    marked_paid = any(
        item.get("after") == "Pago" for item in changes
    ) and (not has_debits)

    return {
        "changes": changes,
        "has_debits": has_debits,
        "marked_paid": marked_paid,
    }


def _emit_tax_portal_run_notification(run: TaxPortalSyncRun, db: Session) -> None:
    severity = "info"
    if run.status == "failed":
        severity = "error"
    elif run.status == "cancelled":
        severity = "warning"

    title = "Tax Portal Sync finalizado"
    if run.status == "failed":
        title = "Tax Portal Sync com falha"
    elif run.status == "cancelled":
        title = "Tax Portal Sync cancelado"

    message = (
        f"Run {run.id} finalizada com status {run.status}. "
        f"Processadas {int(run.processed or 0)}/{int(run.total or 0)} empresas. "
        f"OK={int(run.ok_count or 0)} Erros={int(run.error_count or 0)} Ignoradas={int(run.skipped_count or 0)}."
    )
    emit_org_notification(
        db,
        org_id=run.org_id,
        user_id=run.started_by_user_id,
        event_type="job.tax_portal_sync.finished",
        severity=severity,
        title=title,
        message=message,
        dedupe_key=f"job:tax_portal_sync:{run.id}:{run.status}",
        entity_type="tax_portal_sync_run",
        entity_id=run.id,
        route_path="/painel?tab=taxas",
        metadata_json={
            "run_id": run.id,
            "status": run.status,
            "total": int(run.total or 0),
            "processed": int(run.processed or 0),
            "ok_count": int(run.ok_count or 0),
            "error_count": int(run.error_count or 0),
            "skipped_count": int(run.skipped_count or 0),
            "dry_run": bool(run.dry_run),
            "municipio": run.municipio,
            "limit": run.limit,
        },
        commit=False,
    )


def run_tax_portal_sync_job(run_id: str) -> None:
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(_run_tax_portal_sync_job_async(run_id))


async def _run_tax_portal_sync_job_async(run_id: str) -> None:
    db: Session = SessionLocal()
    try:
        run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
        if not run:
            return

        companies, filtered_out = _select_companies_for_run(db, run)
        run.status = "running"
        run.total = len(companies)
        run.processed = 0
        run.ok_count = 0
        run.error_count = 0
        run.skipped_count = filtered_out
        run.relogin_count = 0
        run.errors = []
        run.summary = {
            "field_counters": {},
            "sample_results": [],
            "companies_with_debits": 0,
            "companies_marked_paid": 0,
            "filtered_out_count": filtered_out,
            "municipio": run.municipio or settings.TAX_PORTAL_DEFAULT_MUNICIPIO,
        }
        db.commit()

        if not companies:
            run.status = "completed"
            run.finished_at = _now_utc()
            _emit_tax_portal_run_notification(run, db)
            db.commit()
            return

        usuario, senha, api_key = load_portal_credentials()

        async with open_tax_portal_page() as page:
            await realizar_login(page, usuario, senha, api_key)

            for idx, company in enumerate(companies, start=1):
                db.expire_all()
                run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
                if not run:
                    return

                if run.status == "cancelled":
                    run.finished_at = _now_utc()
                    run.current_cnpj = None
                    run.current_company_id = None
                    _emit_tax_portal_run_notification(run, db)
                    db.commit()
                    return

                run.current_company_id = company.id
                run.current_cnpj = company.cnpj
                db.commit()

                tentativa = 1
                while tentativa <= int(settings.TAX_PORTAL_MAX_TENTATIVAS):
                    try:
                        taxas = await consultar_cnpj(page, format_cnpj_masked(company.cnpj), idx, len(companies))
                        taxas_formatadas = formatar_status_para_planilha(taxas)

                        result = apply_tax_portal_result_to_company_tax(
                            db=db,
                            org_id=run.org_id,
                            company_id=company.id,
                            run_id=run.id,
                            portal_statuses=taxas_formatadas,
                            raw_taxes=taxas,
                            persist=not run.dry_run,
                        )

                        _merge_summary(
                            run,
                            company,
                            changes=result["changes"],
                            has_debits=result["has_debits"],
                            marked_paid=bool(result.get("marked_paid")),
                        )
                        run.ok_count = int(run.ok_count or 0) + 1
                        db.commit()
                        break

                    except Exception as exc:
                        message = str(exc) or exc.__class__.__name__
                        is_timeout = "timeout" in message.lower() or exc.__class__.__name__.lower() == "timeouterror"

                        if tentativa < int(settings.TAX_PORTAL_MAX_TENTATIVAS) and is_timeout:
                            logger.warning(
                                "Timeout/sessão para %s. Tentando relogin (%s/%s).",
                                company.cnpj,
                                tentativa,
                                settings.TAX_PORTAL_MAX_TENTATIVAS,
                            )
                            await page.goto(PORTAL_URL)
                            await realizar_login(page, usuario, senha, api_key)
                            run.relogin_count = int(run.relogin_count or 0) + 1
                            db.commit()
                            tentativa += 1
                            continue

                        db.rollback()
                        run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
                        if not run:
                            return
                        run.error_count = int(run.error_count or 0) + 1
                        _append_error(run, company, message)
                        db.commit()
                        break

                run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
                if not run:
                    return
                run.processed = idx
                if idx >= len(companies):
                    run.current_cnpj = None
                    run.current_company_id = None
                db.commit()

                if idx < len(companies) and int(settings.TAX_PORTAL_MIN_INTERVAL_SECONDS) > 0:
                    await asyncio.sleep(float(settings.TAX_PORTAL_MIN_INTERVAL_SECONDS))

        run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
        if not run:
            return
        if run.status != "cancelled":
            run.status = "completed"
        run.finished_at = _now_utc()
        run.current_cnpj = None
        run.current_company_id = None
        _emit_tax_portal_run_notification(run, db)
        db.commit()

    except Exception as exc:
        logger.exception("tax_portal_sync failed run_id=%s", run_id)
        db.rollback()
        failed_run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
        if failed_run:
            failed_run.status = "failed"
            failed_run.finished_at = _now_utc()
            failed_run.current_cnpj = None
            failed_run.current_company_id = None
            errors = list(failed_run.errors or [])
            errors.append(
                {
                    "error": f"{exc.__class__.__name__}: {str(exc) or 'sem mensagem'}"[:800],
                    "at": _now_utc().isoformat(),
                }
            )
            failed_run.errors = errors[-MAX_ERROR_ITEMS:]
            _emit_tax_portal_run_notification(failed_run, db)
            db.commit()
    finally:
        db.close()
