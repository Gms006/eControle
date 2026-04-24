from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.company import CompanyOut


class CompanyOverviewScore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    risk_tier: str | None = None
    score_urgencia: int | None = None
    score_status: str | None = None
    score_updated_at: datetime | None = None


class CompanyOverviewCertificate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exists: bool
    status: str
    validade: datetime | None = None
    cert_id: str | None = None
    fingerprint: str | None = None
    updated_at: datetime | None = None


class CompanyOverviewSummaryNextDueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str
    label: str
    due_date: date | datetime | None = None
    status: str | None = None
    urgency: str = "info"


class CompanyOverviewSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pending_taxes_count: int = 0
    critical_licences_count: int = 0
    open_processes_count: int = 0
    certificate_status: str = "NOT_FOUND"
    next_due_items: list[CompanyOverviewSummaryNextDueItem] = []
    has_alerts: bool = False
    risk_tier: str | None = None
    score_urgencia: int | None = None
    score_status: str | None = None
    requires_new_licence_request: bool = False


class CompanyOverviewTaxItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tipo: str
    competencia: str | None = None
    vencimento: date | datetime | None = None
    valor: str | None = None
    status: str | None = None
    urgency: str = "info"


class CompanyOverviewLicenceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tipo: str
    validade: date | None = None
    status: str | None = None
    origem: str | None = None
    alvara_funcionamento_kind: str | None = None
    regulatory_status: str | None = None
    invalidated_reasons: list[str] = []
    invalidating_process_ref: str | None = None
    requires_new_licence_request: bool = False
    critical: bool = False


class CompanyOverviewRegulatoryStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    has_definitive_alvara: bool = False
    definitive_alvara_invalidated: bool = False
    regulatory_status: str = "NOT_APPLICABLE"
    invalidated_reasons: list[str] = []
    invalidating_process_id: str | None = None
    invalidating_process_ref: str | None = None
    requires_new_licence_request: bool = False


class CompanyOverviewProcessItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    protocolo: str
    situacao: str | None = None
    ultima_atualizacao: datetime | None = None
    responsavel: str | None = None
    stalled: bool = False


class CompanyOverviewTimelineItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str
    title: str
    description: str | None = None
    happened_at: date | datetime | None = None
    severity: str = "info"


class CompanyOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company: CompanyOut
    profile: dict
    score: CompanyOverviewScore
    regulatory: CompanyOverviewRegulatoryStatus
    certificate: CompanyOverviewCertificate
    summary: CompanyOverviewSummary
    taxes: list[CompanyOverviewTaxItem]
    licences: list[CompanyOverviewLicenceItem]
    processes: list[CompanyOverviewProcessItem]
    timeline: list[CompanyOverviewTimelineItem]
