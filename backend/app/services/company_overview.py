from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.certificate_mirror import CertificateMirror
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.schemas.company import CompanyOut, enrich_company_with_profile
from app.schemas.company_overview import (
    CompanyOverviewCertificate,
    CompanyOverviewLicenceItem,
    CompanyOverviewProcessItem,
    CompanyOverviewResponse,
    CompanyOverviewScore,
    CompanyOverviewSummary,
    CompanyOverviewSummaryNextDueItem,
    CompanyOverviewTaxItem,
    CompanyOverviewTimelineItem,
)

TAX_FIELD_META = (
    ("taxa_funcionamento", "Taxa de Funcionamento"),
    ("taxa_publicidade", "Taxa de Publicidade"),
    ("taxa_vig_sanitaria", "Taxa de Vigilância Sanitária"),
    ("iss", "ISS"),
    ("taxa_localiz_instalacao", "Taxa de Localização/Instalação"),
    ("taxa_ocup_area_publica", "Taxa de Ocupação de Área Pública"),
    ("taxa_bombeiros", "Taxa de Bombeiros"),
    ("tpi", "TPI"),
)
LICENCE_FIELD_META = (
    ("alvara_vig_sanitaria", "Alvará Vigilância Sanitária", "alvara_vig_sanitaria_valid_until"),
    ("cercon", "Cercon", "cercon_valid_until"),
    ("alvara_funcionamento", "Alvará Funcionamento", "alvara_funcionamento_valid_until"),
    ("licenca_ambiental", "Licença Ambiental", "licenca_ambiental_valid_until"),
    ("certidao_uso_solo", "Certidão de Uso do Solo", "certidao_uso_solo_valid_until"),
)
PROCESS_CLOSED_KEYS = ("conclu", "encerr", "final", "arquiv")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _status_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _is_pending_status(value: str | None) -> bool:
    key = _status_key(value)
    if not key:
        return False
    if "regular" in key or "isento" in key or "quitad" in key or "pago" in key:
        return False
    if "pend" in key or "abert" in key or "venc" in key or "irregular" in key:
        return True
    return False


def _is_closed_process(value: str | None) -> bool:
    key = _status_key(value)
    return any(token in key for token in PROCESS_CLOSED_KEYS)


def _parse_date_like(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _tax_due_from_raw(raw: dict[str, Any], field: str) -> date | None:
    keys = (
        f"vencimento_{field}",
        f"validade_{field}",
        f"due_{field}",
        f"{field}_vencimento",
        f"{field}_validade",
    )
    for key in keys:
        parsed = _parse_date_like(raw.get(key))
        if parsed:
            return parsed
    return None


def _tax_value_from_raw(raw: dict[str, Any], field: str) -> str | None:
    for key in (f"valor_{field}", f"{field}_valor"):
        value = raw.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _tax_competencia_from_raw(raw: dict[str, Any], field: str) -> str | None:
    for key in (f"competencia_{field}", f"{field}_competencia"):
        value = raw.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _tax_urgency(status: str | None, due_date: date | None) -> str:
    today = date.today()
    if _is_pending_status(status):
        if due_date and due_date < today:
            return "critical"
        if due_date and due_date <= today + timedelta(days=7):
            return "warning"
        return "warning"
    if due_date and due_date < today:
        return "warning"
    return "ok"


def _licence_critical(status: str | None, validade: date | None) -> bool:
    key = _status_key(status)
    if "vencid" in key:
        return True
    if validade:
        days = (validade - date.today()).days
        return days <= 30
    return False


def _certificate_status(cert: CertificateMirror | None) -> str:
    if not cert:
        return "NOT_FOUND"
    today = date.today()
    cert_due = cert.not_after.date() if cert.not_after else None
    if cert_due and cert_due < today:
        return "EXPIRED"
    if cert_due and cert_due <= today + timedelta(days=30):
        return "EXPIRING"
    return "VALID"


def _profile_payload(profile: CompanyProfile | None) -> dict[str, Any]:
    if not profile:
        return {}
    return {
        "inscricao_estadual": profile.inscricao_estadual,
        "inscricao_municipal": profile.inscricao_municipal,
        "porte": profile.porte,
        "status_empresa": profile.status_empresa,
        "categoria": profile.categoria,
        "situacao": profile.situacao,
        "certificado_digital": profile.certificado_digital,
        "observacoes": profile.observacoes,
        "proprietario_principal": profile.proprietario_principal,
        "cpf": profile.cpf,
        "telefone": profile.telefone,
        "email": profile.email,
        "responsavel_fiscal": profile.responsavel_fiscal,
        "cnaes_principal": profile.cnaes_principal,
        "cnaes_secundarios": profile.cnaes_secundarios,
        "raw": profile.raw if isinstance(profile.raw, dict) else {},
    }


def _company_with_profile(db: Session, org_id: str, company_id: str) -> Company | None:
    return (
        db.query(Company)
        .options(joinedload(Company.profile))
        .outerjoin(CompanyProfile, (Company.id == CompanyProfile.company_id) & (Company.org_id == CompanyProfile.org_id))
        .filter(Company.id == company_id, Company.org_id == org_id)
        .first()
    )


def _sort_ts(value: date | datetime | None) -> float:
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc).timestamp()
    return float("-inf")


def build_company_overview(db: Session, org_id: str, company_id: str) -> CompanyOverviewResponse | None:
    company = _company_with_profile(db, org_id, company_id)
    if not company:
        return None

    profile = company.profile
    tax = db.query(CompanyTax).filter(CompanyTax.org_id == org_id, CompanyTax.company_id == company.id).first()
    licence = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.org_id == org_id, CompanyLicence.company_id == company.id)
        .first()
    )
    processes = (
        db.query(CompanyProcess)
        .filter(CompanyProcess.org_id == org_id, CompanyProcess.company_id == company.id)
        .order_by(CompanyProcess.updated_at.desc())
        .limit(10)
        .all()
    )
    cert = (
        db.query(CertificateMirror)
        .filter(CertificateMirror.org_id == org_id, CertificateMirror.company_id == company.id)
        .order_by(CertificateMirror.not_after.is_(None), CertificateMirror.not_after.desc(), CertificateMirror.updated_at.desc())
        .first()
    )

    raw_tax = tax.raw if tax and isinstance(tax.raw, dict) else {}
    taxes: list[CompanyOverviewTaxItem] = []
    for field, label in TAX_FIELD_META:
        if not tax:
            break
        status_value = getattr(tax, field, None)
        due_date = _tax_due_from_raw(raw_tax, field)
        if field == "tpi" and not due_date:
            due_date = _parse_date_like(getattr(tax, "vencimento_tpi", None))
        value = _tax_value_from_raw(raw_tax, field)
        competencia = _tax_competencia_from_raw(raw_tax, field)
        if status_value is None and due_date is None and value is None and competencia is None:
            continue
        taxes.append(
            CompanyOverviewTaxItem(
                id=f"{tax.id}:{field}",
                tipo=label,
                competencia=competencia,
                vencimento=due_date,
                valor=value,
                status=status_value,
                urgency=_tax_urgency(status_value, due_date),
            )
        )

    taxes.sort(
        key=lambda item: (
            0 if item.urgency == "critical" else 1 if item.urgency == "warning" else 2,
            _parse_date_like(item.vencimento) or date.max,
        )
    )
    taxes = taxes[:8]

    licences: list[CompanyOverviewLicenceItem] = []
    raw_lic = licence.raw if licence and isinstance(licence.raw, dict) else {}
    for field, label, valid_field in LICENCE_FIELD_META:
        if not licence:
            break
        status_value = getattr(licence, field, None)
        validade = getattr(licence, valid_field, None)
        origem = raw_lic.get(f"source_kind_{field}")
        if status_value is None and validade is None and origem is None:
            continue
        licences.append(
            CompanyOverviewLicenceItem(
                tipo=label,
                validade=validade,
                status=status_value,
                origem=origem,
                critical=_licence_critical(status_value, validade),
            )
        )

    licences.sort(key=lambda item: (0 if item.critical else 1, item.validade or date.max))
    licences = licences[:8]

    overview_processes: list[CompanyOverviewProcessItem] = []
    for proc in processes:
        raw = proc.raw if isinstance(proc.raw, dict) else {}
        extra = proc.extra if isinstance(proc.extra, dict) else {}
        responsavel = extra.get("responsavel") or raw.get("responsavel")
        updated_at = proc.updated_at
        stalled = not _is_closed_process(proc.situacao) and bool(
            updated_at and updated_at.date() < (date.today() - timedelta(days=45))
        )
        title = str(proc.operacao or extra.get("assunto") or proc.process_type or "Processo")
        overview_processes.append(
            CompanyOverviewProcessItem(
                id=proc.id,
                titulo=title,
                protocolo=proc.protocolo,
                situacao=proc.situacao,
                ultima_atualizacao=updated_at,
                responsavel=responsavel,
                stalled=stalled,
            )
        )

    cert_status = _certificate_status(cert)
    certificate = CompanyOverviewCertificate(
        exists=bool(cert),
        status=cert_status,
        validade=(cert.not_after if cert else None),
        cert_id=(cert.cert_id if cert else None),
        fingerprint=(cert.sha1_fingerprint if cert else None),
        updated_at=(cert.updated_at if cert else None),
    )

    pending_taxes_count = sum(1 for item in taxes if item.urgency in {"warning", "critical"})
    critical_licences_count = sum(1 for item in licences if item.critical)
    open_processes_count = sum(1 for item in overview_processes if not _is_closed_process(item.situacao))
    has_alerts = pending_taxes_count > 0 or critical_licences_count > 0 or any(p.stalled for p in overview_processes)
    if cert_status in {"EXPIRED", "EXPIRING", "NOT_FOUND"}:
        has_alerts = True

    next_due_items: list[CompanyOverviewSummaryNextDueItem] = []
    for tax_item in taxes:
        due = _parse_date_like(tax_item.vencimento)
        if not due:
            continue
        next_due_items.append(
            CompanyOverviewSummaryNextDueItem(
                kind="tax",
                label=tax_item.tipo,
                due_date=due,
                status=tax_item.status,
                urgency=tax_item.urgency,
            )
        )
    for lic_item in licences:
        if not lic_item.validade:
            continue
        next_due_items.append(
            CompanyOverviewSummaryNextDueItem(
                kind="licence",
                label=lic_item.tipo,
                due_date=lic_item.validade,
                status=lic_item.status,
                urgency="critical" if lic_item.critical else "ok",
            )
        )
    if certificate.validade:
        next_due_items.append(
            CompanyOverviewSummaryNextDueItem(
                kind="certificate",
                label="Certificado digital",
                due_date=certificate.validade,
                status=certificate.status,
                urgency="critical" if certificate.status == "EXPIRED" else ("warning" if certificate.status == "EXPIRING" else "ok"),
            )
        )
    next_due_items.sort(key=lambda item: _parse_date_like(item.due_date) or date.max)
    next_due_items = next_due_items[:6]

    timeline: list[CompanyOverviewTimelineItem] = []
    for item in next_due_items[:4]:
        timeline.append(
            CompanyOverviewTimelineItem(
                kind=f"due_{item.kind}",
                title=f"Próximo vencimento: {item.label}",
                description=item.status,
                happened_at=item.due_date,
                severity=item.urgency,
            )
        )
    if overview_processes:
        latest_proc = overview_processes[0]
        timeline.append(
            CompanyOverviewTimelineItem(
                kind="process_update",
                title=f"Processo atualizado: {latest_proc.titulo}",
                description=latest_proc.situacao,
                happened_at=latest_proc.ultima_atualizacao,
                severity="warning" if latest_proc.stalled else "info",
            )
        )
    if certificate.updated_at:
        timeline.append(
            CompanyOverviewTimelineItem(
                kind="certificate_update",
                title="Atualização de certificado",
                description=certificate.status,
                happened_at=certificate.updated_at,
                severity="critical" if certificate.status == "EXPIRED" else "info",
            )
        )
    if profile and profile.score_updated_at:
        timeline.append(
            CompanyOverviewTimelineItem(
                kind="score_update",
                title="Score atualizado",
                description=profile.score_status,
                happened_at=profile.score_updated_at,
                severity="info",
            )
        )
    timeline.sort(key=lambda item: _sort_ts(item.happened_at), reverse=True)
    timeline = timeline[:12]

    score = CompanyOverviewScore(
        risk_tier=profile.risco_consolidado if profile else None,
        score_urgencia=profile.score_urgencia if profile else None,
        score_status=profile.score_status if profile else None,
        score_updated_at=profile.score_updated_at if profile else None,
    )
    summary = CompanyOverviewSummary(
        pending_taxes_count=pending_taxes_count,
        critical_licences_count=critical_licences_count,
        open_processes_count=open_processes_count,
        certificate_status=certificate.status,
        next_due_items=next_due_items,
        has_alerts=has_alerts,
        risk_tier=score.risk_tier,
        score_urgencia=score.score_urgencia,
        score_status=score.score_status,
    )

    company = enrich_company_with_profile(company)
    company.situacao_debito = "Possui Débito" if pending_taxes_count > 0 else "Sem Débitos"
    return CompanyOverviewResponse(
        company=CompanyOut.model_validate(company),
        profile=_profile_payload(profile),
        score=score,
        certificate=certificate,
        summary=summary,
        taxes=taxes,
        licences=licences,
        processes=overview_processes,
        timeline=timeline,
    )
