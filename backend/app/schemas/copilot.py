from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CopilotCategory(str, Enum):
    COMPANY_SUMMARY = "COMPANY_SUMMARY"
    DOCUMENT_ANALYSIS = "DOCUMENT_ANALYSIS"
    RISK_SIMULATION = "RISK_SIMULATION"
    DUVIDAS_DIVERSAS = "DUVIDAS_DIVERSAS"


class CopilotSectionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    kind: str = "text"
    content: str
    items: list[str] = Field(default_factory=list)


class CopilotSuggestedActionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    label: str
    action_type: str | None = None
    url: str | None = None
    target: str | None = None
    payload: dict[str, Any] | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_from_string_or_dict(cls, value):
        if isinstance(value, str):
            return {"label": value}
        if isinstance(value, dict):
            return value
        return {"label": str(value)}


class CopilotEvidenceOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str
    value: str
    source: str | None = None


class CopilotSourceOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    url: str
    snippet: str | None = None


class CopilotSimulationResultOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    score_before: int | None = None
    score_after: int | None = None
    delta: int | None = None
    risk_tier_before: str | None = None
    risk_tier_after: str | None = None
    applied_assumptions: list[str] = Field(default_factory=list)
    top_impacts: list[dict[str, Any]] = Field(default_factory=list)


class CopilotCompanyContextOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    company_id: str | None = None
    razao_social: str | None = None
    cnpj: str | None = None
    municipio: str | None = None
    risk_tier: str | None = None
    score_urgencia: int | None = None
    score_status: str | None = None


class CopilotResponseOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    category: CopilotCategory
    company_context: CopilotCompanyContextOut
    answer_markdown: str
    sections: list[CopilotSectionOut] = Field(default_factory=list)
    suggested_actions: list[CopilotSuggestedActionOut] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[CopilotEvidenceOut] = Field(default_factory=list)
    simulation_result: CopilotSimulationResultOut | None = None
    requires_company: bool = False
    not_conclusive_reason: str | None = None
    grounding_used: bool = False
    sources: list[CopilotSourceOut] = Field(default_factory=list)
    provider_info: dict[str, Any] | None = None
