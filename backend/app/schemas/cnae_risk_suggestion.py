from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.cnae import normalize_cnae_code


CNAERiskSuggestionStatus = Literal["PENDING", "APPROVED", "REJECTED", "APPLIED"]


def _normalize_optional_risk(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    return normalized or None


class CNAERiskSuggestionCreate(BaseModel):
    cnae_code: str
    suggested_risk_tier: str | None = None
    suggested_base_weight: int | None = Field(default=None, ge=0, le=1000)
    suggested_sanitary_risk: str | None = None
    suggested_fire_risk: str | None = None
    suggested_environmental_risk: str | None = None
    source_name: str = Field(min_length=1, max_length=128)
    source_reference: str | None = Field(default=None, max_length=512)
    evidence_excerpt: str | None = None
    org_id: str | None = None

    @field_validator("cnae_code")
    @classmethod
    def validate_cnae_code(cls, value: str) -> str:
        normalized = normalize_cnae_code(value)
        if not normalized:
            raise ValueError("Invalid cnae_code")
        return normalized

    @field_validator(
        "suggested_risk_tier",
        "suggested_sanitary_risk",
        "suggested_fire_risk",
        "suggested_environmental_risk",
        mode="before",
    )
    @classmethod
    def normalize_optional_risk(cls, value: str | None) -> str | None:
        return _normalize_optional_risk(value)


class CNAERiskSuggestionUpdate(BaseModel):
    cnae_code: str | None = None
    suggested_risk_tier: str | None = None
    suggested_base_weight: int | None = Field(default=None, ge=0, le=1000)
    suggested_sanitary_risk: str | None = None
    suggested_fire_risk: str | None = None
    suggested_environmental_risk: str | None = None
    source_name: str | None = Field(default=None, min_length=1, max_length=128)
    source_reference: str | None = Field(default=None, max_length=512)
    evidence_excerpt: str | None = None
    org_id: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("cnae_code")
    @classmethod
    def validate_cnae_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_cnae_code(value)
        if not normalized:
            raise ValueError("Invalid cnae_code")
        return normalized

    @field_validator(
        "suggested_risk_tier",
        "suggested_sanitary_risk",
        "suggested_fire_risk",
        "suggested_environmental_risk",
        mode="before",
    )
    @classmethod
    def normalize_optional_risk(cls, value: str | None) -> str | None:
        return _normalize_optional_risk(value)


class CNAERiskSuggestionRejectRequest(BaseModel):
    evidence_excerpt: str | None = None


class CNAERiskSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str | None
    cnae_code: str
    suggested_risk_tier: str | None
    suggested_base_weight: int | None
    suggested_sanitary_risk: str | None
    suggested_fire_risk: str | None
    suggested_environmental_risk: str | None
    source_name: str
    source_reference: str | None
    evidence_excerpt: str | None
    status: CNAERiskSuggestionStatus
    reviewed_by: str | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CNAERiskSuggestionApproveOut(BaseModel):
    suggestion: CNAERiskSuggestionOut
    applied_to_catalog: bool
    affected_companies: int
    recalculated_companies: int
    changed_companies: int
