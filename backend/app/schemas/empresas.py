from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class EmpresaView(BaseModel):
    empresa_id: int = Field(..., description="Identificador interno da empresa")
    org_id: UUID
    empresa: str
    cnpj: str
    municipio: Optional[str] = None
    porte: Optional[str] = None
    categoria: Optional[str] = None
    status_empresas: Optional[str] = None
    situacao: Optional[str] = None
    debito: Optional[str] = None
    certificado: Optional[str] = None
    total_licencas: int = 0
    total_taxas: int = 0
    processos_ativos: int = 0
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmpresaListResponse(PaginatedResponse[EmpresaView]):
    pass


class EmpresaBase(BaseModel):
    empresa: str
    cnpj: str
    municipio: str
    porte: Optional[str] = None
    categoria: Optional[str] = None
    status_empresas: Optional[str] = None
    situacao: Optional[str] = None
    debito: Optional[str] = None
    certificado: Optional[str] = None
    ie: Optional[str] = None
    im: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    obs: Optional[str] = None
    proprietario: Optional[str] = None
    cpf: Optional[str] = None
    responsavel: Optional[str] = None
    responsavel_legal: Optional[str] = None
    cpf_responsavel_legal: Optional[str] = None
    responsavel_fiscal: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaUpdate(BaseModel):
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    municipio: Optional[str] = None
    porte: Optional[str] = None
    categoria: Optional[str] = None
    status_empresas: Optional[str] = None
    situacao: Optional[str] = None
    debito: Optional[str] = None
    certificado: Optional[str] = None
    ie: Optional[str] = None
    im: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    obs: Optional[str] = None
    proprietario: Optional[str] = None
    cpf: Optional[str] = None
    responsavel: Optional[str] = None
    responsavel_legal: Optional[str] = None
    cpf_responsavel_legal: Optional[str] = None
    responsavel_fiscal: Optional[str] = None

    model_config = ConfigDict(extra="forbid")
