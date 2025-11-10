from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class LicencaView(BaseModel):
    licenca_id: int = Field(..., description="Identificador da licença")
    empresa_id: int
    org_id: UUID
    empresa: str
    cnpj: str
    municipio: Optional[str] = None
    tipo: str
    status: str
    validade: Optional[date] = None
    dias_para_vencer: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LicencaListResponse(PaginatedResponse[LicencaView]):
    pass


class LicencaBase(BaseModel):
    empresa_id: int
    tipo: str
    status: str
    validade: Optional[date] = None
    obs: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class LicencaCreate(LicencaBase):
    pass


class LicencaUpdate(BaseModel):
    tipo: Optional[str] = None
    status: Optional[str] = None
    validade: Optional[date] = None
    obs: Optional[str] = None

    model_config = ConfigDict(extra="forbid")
