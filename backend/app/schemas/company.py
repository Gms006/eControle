from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.fs_dirname import normalize_fs_dirname
from app.core.regulatory import (
    DEFAULT_ADDRESS_LOCATION_TYPE,
    DEFAULT_ADDRESS_USAGE_TYPE,
    DEFAULT_SANITARY_COMPLEXITY,
    normalize_address_location_type,
    normalize_address_usage_type,
    normalize_sanitary_complexity,
)


class CompanyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cnpj: Optional[str] = None
    company_cpf: Optional[str] = None
    razao_social: str
    nome_fantasia: Optional[str] = None
    fs_dirname: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("fs_dirname")
    @classmethod
    def validate_fs_dirname(cls, value: Optional[str]) -> Optional[str]:
        return normalize_fs_dirname(value)


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cnpj: Optional[str] = None
    company_cpf: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    fs_dirname: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = None

    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    porte: Optional[str] = None
    status_empresa: Optional[str] = None
    categoria: Optional[str] = None
    situacao: Optional[str] = None
    certificado_digital: Optional[str] = None
    observacoes: Optional[str] = None
    proprietario_principal: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    responsavel_fiscal: Optional[str] = None
    cnaes_principal: Optional[list[dict]] = None
    cnaes_secundarios: Optional[list[dict]] = None
    mei: Optional[bool] = None
    endereco_fiscal: Optional[bool] = None
    sanitary_complexity: Optional[str] = None
    address_usage_type: Optional[str] = None
    address_location_type: Optional[str] = None

    @field_validator("fs_dirname")
    @classmethod
    def validate_fs_dirname(cls, value: Optional[str]) -> Optional[str]:
        return normalize_fs_dirname(value)

    @field_validator("sanitary_complexity")
    @classmethod
    def validate_sanitary_complexity(cls, value: Optional[str]) -> Optional[str]:
        return normalize_sanitary_complexity(value)

    @field_validator("address_usage_type")
    @classmethod
    def validate_address_usage_type(cls, value: Optional[str]) -> Optional[str]:
        return normalize_address_usage_type(value)

    @field_validator("address_location_type")
    @classmethod
    def validate_address_location_type(cls, value: Optional[str]) -> Optional[str]:
        return normalize_address_location_type(value)


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    cnpj: Optional[str] = None
    company_cpf: Optional[str] = None
    razao_social: str
    nome_fantasia: Optional[str] = None
    fs_dirname: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    # Campos do company_profile
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    porte: Optional[str] = None
    status_empresa: Optional[str] = None
    categoria: Optional[str] = None
    situacao: Optional[str] = None
    situacao_debito: Optional[str] = None
    certificado_digital: Optional[str] = None
    observacoes: Optional[str] = None
    proprietario_principal: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    responsavel_fiscal: Optional[str] = None
    cnaes_principal: Optional[list[dict]] = None
    cnaes_secundarios: Optional[list[dict]] = None
    risco_consolidado: Optional[str] = None
    score_urgencia: Optional[int] = None
    score_status: Optional[str] = None
    score_updated_at: Optional[datetime] = None
    sanitary_complexity: Optional[str] = DEFAULT_SANITARY_COMPLEXITY
    address_usage_type: Optional[str] = DEFAULT_ADDRESS_USAGE_TYPE
    address_location_type: Optional[str] = DEFAULT_ADDRESS_LOCATION_TYPE
    mei: Optional[bool] = None
    endereco_fiscal: Optional[bool] = None


def enrich_company_with_profile(company):
    """Adiciona atributos do profile à instância de Company para serialização"""
    company.company_cpf = getattr(company, "cpf", None)
    profile = getattr(company, 'profile', None)
    if profile:
        company.inscricao_estadual = profile.inscricao_estadual
        company.inscricao_municipal = profile.inscricao_municipal
        company.porte = profile.porte
        company.status_empresa = profile.status_empresa
        company.categoria = profile.categoria
        company.situacao = profile.situacao
        company.certificado_digital = profile.certificado_digital
        company.observacoes = profile.observacoes
        company.proprietario_principal = profile.proprietario_principal
        company.cpf = profile.cpf
        company.telefone = profile.telefone
        company.email = profile.email
        company.responsavel_fiscal = profile.responsavel_fiscal
        company.cnaes_principal = profile.cnaes_principal
        company.cnaes_secundarios = profile.cnaes_secundarios
        company.risco_consolidado = profile.risco_consolidado
        company.score_urgencia = profile.score_urgencia
        company.score_status = profile.score_status
        company.score_updated_at = profile.score_updated_at
        company.sanitary_complexity = profile.sanitary_complexity
        company.address_usage_type = profile.address_usage_type
        company.address_location_type = profile.address_location_type
        raw = profile.raw if isinstance(profile.raw, dict) else {}
        company.mei = bool(raw.get("mei")) if "mei" in raw else None
        if company.address_usage_type and company.address_usage_type != DEFAULT_ADDRESS_USAGE_TYPE:
            company.endereco_fiscal = company.address_usage_type == "FISCAL"
        else:
            company.endereco_fiscal = bool(raw.get("endereco_fiscal")) if "endereco_fiscal" in raw else None
    return company

