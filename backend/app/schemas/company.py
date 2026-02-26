from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CompanyCreate(BaseModel):
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyUpdate(BaseModel):
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
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
    debito_prefeitura: Optional[str] = None
    certificado_digital: Optional[str] = None
    observacoes: Optional[str] = None
    proprietario_principal: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    responsavel_fiscal: Optional[str] = None


def enrich_company_with_profile(company):
    """Adiciona atributos do profile à instância de Company para serialização"""
    profile = getattr(company, 'profile', None)
    if profile:
        company.inscricao_estadual = profile.inscricao_estadual
        company.inscricao_municipal = profile.inscricao_municipal
        company.porte = profile.porte
        company.status_empresa = profile.status_empresa
        company.categoria = profile.categoria
        company.situacao = profile.situacao
        company.debito_prefeitura = profile.debito_prefeitura
        company.certificado_digital = profile.certificado_digital
        company.observacoes = profile.observacoes
        company.proprietario_principal = profile.proprietario_principal
        company.cpf = profile.cpf
        company.telefone = profile.telefone
        company.email = profile.email
        company.responsavel_fiscal = profile.responsavel_fiscal
    return company

