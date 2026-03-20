from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.cnae import normalize_cnae_code
from app.schemas.cnae_risk_suggestion import CNAERiskSuggestionOut


OfficialDomain = Literal["general", "sanitary", "fire", "municipal", "environmental"]
OfficialSourceName = Literal["CGSIM", "ANVISA", "GOIANIA", "CBMGO"]


class OfficialSourceFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cnae_code: str
    domain: OfficialDomain
    official_result: str
    suggested_risk_tier: str | None = None
    suggested_base_weight: int | None = Field(default=None, ge=0, le=1000)
    source_name: OfficialSourceName
    source_reference: str
    evidence_excerpt: str
    confidence: float = Field(ge=0.0, le=1.0)
    requires_questionnaire: bool = False

    @field_validator("cnae_code")
    @classmethod
    def validate_cnae_code(cls, value: str) -> str:
        normalized = normalize_cnae_code(value)
        if not normalized:
            raise ValueError("Invalid cnae_code")
        return normalized

    @field_validator("suggested_risk_tier", mode="before")
    @classmethod
    def normalize_tier(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip().upper()
        return text or None


class OfficialSourceLookupRequest(BaseModel):
    cnae_code: str
    sources: list[OfficialSourceName] | None = None

    @field_validator("cnae_code")
    @classmethod
    def validate_cnae_code(cls, value: str) -> str:
        normalized = normalize_cnae_code(value)
        if not normalized:
            raise ValueError("Invalid cnae_code")
        return normalized


class OfficialSourceLookupBatchRequest(BaseModel):
    cnae_codes: list[str] = Field(min_length=1, max_length=200)
    sources: list[OfficialSourceName] | None = None

    @field_validator("cnae_codes")
    @classmethod
    def validate_cnae_codes(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in values:
            code = normalize_cnae_code(item)
            if not code:
                continue
            if code not in normalized:
                normalized.append(code)
        if not normalized:
            raise ValueError("No valid cnae_codes")
        return normalized


class OfficialSourceError(BaseModel):
    source_name: OfficialSourceName
    message: str


class OfficialSourceLookupResponse(BaseModel):
    findings: list[OfficialSourceFinding]
    suggestions_created: list[CNAERiskSuggestionOut]
    skipped_duplicates: int
    source_errors: list[OfficialSourceError]
