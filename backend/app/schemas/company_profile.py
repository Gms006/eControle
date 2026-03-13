from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CompanyProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str
    external_id: Optional[str] = None
    porte: Optional[str] = None
    status_empresa: Optional[str] = None
    categoria: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
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
    risco_consolidado: Optional[str] = None
    score_urgencia: Optional[int] = None
    score_status: Optional[str] = None
    score_updated_at: Optional[datetime] = None
    raw: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
