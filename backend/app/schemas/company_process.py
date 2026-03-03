from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.normalize import (
    PROCESS_SITUACAO_LABELS,
    normalize_date_br,
    normalize_process_situacao,
)

PROCESS_SITUACOES = tuple(PROCESS_SITUACAO_LABELS.keys())


class CompanyProcessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str

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

    company_id: str
    process_type: str
    protocolo: str

    municipio: Optional[str] = None
    orgao: Optional[str] = None
    operacao: Optional[str] = None
    data_solicitacao: Optional[str] = None
    situacao: Optional[str] = None
    obs: Optional[str] = None
    extra: Optional[dict] = None

    @field_validator("situacao", mode="before")
    @classmethod
    def validate_situacao(cls, value: str | None) -> str | None:
        return normalize_process_situacao(value, strict=True)

    @field_validator("data_solicitacao", mode="before")
    @classmethod
    def validate_data_solicitacao(cls, value: str | None) -> str | None:
        return normalize_date_br(value, strict=True)


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
