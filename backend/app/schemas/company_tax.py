from datetime import datetime
from typing import Optional
import re

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.core.normalize import normalize_date_br

DATA_ENVIO_PATTERN = re.compile(
    r"^\s*(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})(?:\s*-\s*(.+))?\s*$"
)


def _status_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _requires_envio(value: str | None) -> bool:
    return _status_key(value) in {"em_aberto", "pendente"}


def _has_data_envio_date(value: str | None) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    match = DATA_ENVIO_PATTERN.match(text)
    if not match:
        return False
    return bool(normalize_date_br(match.group(1), strict=False))


def normalize_data_envio(value: str | None) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None

    match = DATA_ENVIO_PATTERN.match(text)
    if not match:
        raise ValueError("data_envio must be in 'dd/mm/aaaa' or 'dd/mm/aaaa - metodos'")

    date_part = normalize_date_br(match.group(1), strict=True)
    year, month, day = date_part.split("-")
    date_br = f"{day}/{month}/{year}"
    methods = (match.group(2) or "").strip()
    if not methods:
        return date_br
    methods = re.sub(r"\s+", " ", methods)
    return f"{date_br} - {methods}"


class CompanyTaxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str

    data_envio: Optional[str] = None
    taxa_funcionamento: Optional[str] = None
    taxa_publicidade: Optional[str] = None
    taxa_vig_sanitaria: Optional[str] = None
    iss: Optional[str] = None
    taxa_localiz_instalacao: Optional[str] = None
    taxa_ocup_area_publica: Optional[str] = None
    taxa_bombeiros: Optional[str] = None
    tpi: Optional[str] = None
    vencimento_tpi: Optional[str] = None
    status_taxas: Optional[str] = None
    envio_pendente: bool = False
    motivo_envio_pendente: Optional[str] = None

    raw: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def derive_envio_pendente(self) -> "CompanyTaxOut":
        tracked_fields = [
            self.taxa_funcionamento,
            self.taxa_publicidade,
            self.taxa_vig_sanitaria,
            self.iss,
            self.taxa_localiz_instalacao,
            self.taxa_ocup_area_publica,
            self.taxa_bombeiros,
            self.tpi,
        ]
        has_open_tax = any(_requires_envio(value) for value in tracked_fields)
        has_envio_date = _has_data_envio_date(self.data_envio)
        self.envio_pendente = has_open_tax and not has_envio_date
        self.motivo_envio_pendente = (
            "Taxas em aberto sem data de envio."
            if self.envio_pendente
            else None
        )
        return self


class CompanyTaxUpdate(BaseModel):
    """Patch de Taxas (campo de envio com data e métodos legados)."""

    model_config = ConfigDict(extra="forbid")

    data_envio: Optional[str] = None
    taxa_funcionamento: Optional[str] = None
    taxa_publicidade: Optional[str] = None
    taxa_vig_sanitaria: Optional[str] = None
    iss: Optional[str] = None
    taxa_localiz_instalacao: Optional[str] = None
    taxa_ocup_area_publica: Optional[str] = None
    taxa_bombeiros: Optional[str] = None
    tpi: Optional[str] = None
    vencimento_tpi: Optional[str] = None
    raw: Optional[dict] = None

    @field_validator("data_envio", mode="before")
    @classmethod
    def validate_data_envio(cls, value: str | None) -> str | None:
        return normalize_data_envio(value)
