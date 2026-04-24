from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.normalize import (
    PROCESS_SITUACAO_LABELS,
    normalize_date_br,
    normalize_process_type,
    normalize_process_situacao,
)

PROCESS_SITUACOES = tuple(PROCESS_SITUACAO_LABELS.keys())


class CompanyProcessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: Optional[str] = None

    process_type: str
    protocolo: str

    municipio: Optional[str] = None
    orgao: Optional[str] = None
    operacao: Optional[str] = None
    data_solicitacao: Optional[str] = None
    situacao: Optional[str] = None
    obs: Optional[str] = None

    extra: Optional[dict] = None
    raw: Optional[dict] = None

    created_at: datetime
    updated_at: datetime


class CompanyProcessCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_id: Optional[str] = None
    company_cnpj: Optional[str] = None
    company_razao_social: Optional[str] = None
    empresa_nao_cadastrada: bool = False
    process_type: str
    protocolo: str

    municipio: Optional[str] = None
    orgao: Optional[str] = None
    operacao: Optional[str] = None
    data_solicitacao: Optional[str] = None
    situacao: Optional[str] = None
    obs: Optional[str] = None
    extra: Optional[dict] = None

    @field_validator("process_type", mode="before")
    @classmethod
    def validate_process_type(cls, value: str | None) -> str:
        normalized = normalize_process_type(value)
        if not normalized:
            raise ValueError("process_type is required")
        return normalized

    @field_validator("situacao", mode="before")
    @classmethod
    def validate_situacao(cls, value: str | None) -> str | None:
        return normalize_process_situacao(value, strict=True)

    @field_validator("data_solicitacao", mode="before")
    @classmethod
    def validate_data_solicitacao(cls, value: str | None) -> str | None:
        return normalize_date_br(value, strict=True)

    @field_validator("company_cnpj", mode="before")
    @classmethod
    def validate_company_cnpj(cls, value: str | None) -> str | None:
        if value is None:
            return None
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        if not digits:
            return None
        if len(digits) != 14:
            raise ValueError("company_cnpj must have 14 digits")
        return digits


class CompanyProcessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    process_type: Optional[str] = None
    protocolo: Optional[str] = None
    municipio: Optional[str] = None
    orgao: Optional[str] = None
    operacao: Optional[str] = None
    data_solicitacao: Optional[str] = None
    situacao: Optional[str] = None
    obs: Optional[str] = None
    extra: Optional[dict] = None

    @field_validator("process_type", mode="before")
    @classmethod
    def validate_process_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_process_type(value)
        if not normalized:
            raise ValueError("process_type is required")
        return normalized

    @field_validator("situacao", mode="before")
    @classmethod
    def validate_situacao(cls, value: str | None) -> str | None:
        return normalize_process_situacao(value, strict=True)

    @field_validator("data_solicitacao", mode="before")
    @classmethod
    def validate_data_solicitacao(cls, value: str | None) -> str | None:
        return normalize_date_br(value, strict=True)


class CompanyProcessObsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    obs: Optional[str] = None


class CompanyProcessObsHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: str = "updated"
