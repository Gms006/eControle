from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.core.normalize import normalize_date_br, normalize_generic_status


LICENCE_FIELDS = (
    "alvara_vig_sanitaria",
    "cercon",
    "alvara_funcionamento",
    "licenca_ambiental",
    "certidao_uso_solo",
)


class CompanyLicenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str
    municipio: Optional[str] = None
    alvara_vig_sanitaria: Optional[str] = None
    cercon: Optional[str] = None
    alvara_funcionamento: Optional[str] = None
    licenca_ambiental: Optional[str] = None
    certidao_uso_solo: Optional[str] = None
    motivo_nao_exigido: Optional[str] = None
    justificativa_nao_exigido: Optional[str] = None
    company_name: Optional[str] = None
    company_cnpj: Optional[str] = None
    company_razao_social: Optional[str] = None
    company_municipio: Optional[str] = None
    sem_vinculo: bool = False
    raw: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class CompanyLicenceItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    status: str
    validade: Optional[str] = None
    motivo_nao_exigido: Optional[str] = None
    justificativa_nao_exigido: Optional[str] = None
    observacao: Optional[str] = None
    responsavel: Optional[str] = None
    proxima_acao: Optional[str] = None

    @field_validator("field")
    @classmethod
    def validate_field(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized not in LICENCE_FIELDS:
            raise ValueError("field is not allowed")
        return normalized

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value: str | None) -> str:
        normalized = normalize_generic_status(value, strict=True)
        if not normalized:
            raise ValueError("status is required")
        return normalized

    @field_validator("validade", mode="before")
    @classmethod
    def validate_validade(cls, value: str | None) -> str | None:
        return normalize_date_br(value, strict=False)

    @model_validator(mode="after")
    def validate_nao_exigido_fields(self):
        if self.status == "nao_exigido":
            if not str(self.motivo_nao_exigido or "").strip():
                raise ValueError("motivo_nao_exigido is required when status is nao_exigido")
            if not str(self.justificativa_nao_exigido or "").strip():
                raise ValueError("justificativa_nao_exigido is required when status is nao_exigido")
        return self
