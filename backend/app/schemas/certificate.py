from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class CertHubCertificateIn(BaseModel):
    cert_id: Optional[str] = None
    name: Optional[str] = None
    cn: Optional[str] = None
    issuer_cn: Optional[str] = None
    document_type: Optional[str] = None
    document_masked: Optional[str] = None
    serial_number: Optional[str] = None
    sha1_fingerprint: Optional[str] = None
    parse_ok: bool = True
    not_before: Optional[datetime] = None
    not_after: Optional[datetime] = None
    last_ingested_at: Optional[datetime] = None
    raw: Optional[dict[str, Any]] = None

    class Config:
        extra = "allow"


class CertificateOut(BaseModel):
    id: str
    org_id: str
    company_id: Optional[str] = None

    cert_id: Optional[str] = None
    sha1_fingerprint: Optional[str] = None

    titular: Optional[str] = None
    cnpj: Optional[str] = None

    valido_de: Optional[datetime] = None
    valido_ate: Optional[datetime] = None
    dias_restantes: Optional[int] = None
    situacao: str


class CertificateSyncRequest(BaseModel):
    """
    Se certificates vier preenchido => modo payload (recomendado).
    Se nao vier => modo pull (usa env CERTHUB_*).
    """

    certificates: Optional[list[CertHubCertificateIn]] = None


class CertificateSyncResponse(BaseModel):
    received: int
    inserted: int
    updated: int
    mapped_companies: int
    unmapped_cnpjs: int
    updated_company_profiles: int


class CertificateHealthResponse(BaseModel):
    count: int
    last_ingested_at: Optional[datetime] = None
