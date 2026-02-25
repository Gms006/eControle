from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.ingest.common import IngestOrg, IngestSource
from app.schemas.ingest.licences import LicenceIngestItem
from app.schemas.ingest.processes import ProcessIngestItem
from app.schemas.ingest.taxes import TaxIngestItem


class CompanyIngestItem(BaseModel):
    external_id: Optional[str] = None
    empresa: Optional[str] = None  # alias "razao_social" if provided
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj: str
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = True

    # --- Profile fields (stored in company_profiles) ---
    porte: Optional[str] = None
    status_empresa: Optional[str] = None
    categoria: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    situacao: Optional[str] = None
    debito_prefeitura: Optional[str] = None
    certificado_digital: Optional[str] = None
    observacoes: Optional[str] = None
    proprietario_principal: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    responsavel_fiscal: Optional[str] = None
    raw: Optional[dict] = None


class CompaniesIngestEnvelope(BaseModel):
    source: IngestSource
    org: IngestOrg | None = None
    companies: list[CompanyIngestItem] = Field(default_factory=list)
    source_hash: Optional[str] = None  # optional: computed if not provided

    # Optional datasets (S7 deliverables)
    licences: list[LicenceIngestItem] = Field(default_factory=list)
    taxes: list[TaxIngestItem] = Field(default_factory=list)
    processes: list[ProcessIngestItem] = Field(default_factory=list)
