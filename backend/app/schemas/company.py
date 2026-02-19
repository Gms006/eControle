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
