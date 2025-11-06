from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class TaxaView(BaseModel):
    taxa_id: int = Field(..., description="Identificador da taxa")
    empresa_id: int
    org_id: str
    empresa: str
    cnpj: str
    tipo: str
    status: str
    data_envio: Optional[date] = None
    vencimento_tpi: Optional[date] = None
    esta_pago: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class TaxaListResponse(PaginatedResponse[TaxaView]):
    pass


class TaxaBase(BaseModel):
    empresa_id: int
    tipo: str
    status: str
    data_envio: Optional[date] = None
    vencimento_tpi: Optional[date] = None
    obs: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class TaxaCreate(TaxaBase):
    pass


class TaxaUpdate(BaseModel):
    tipo: Optional[str] = None
    status: Optional[str] = None
    data_envio: Optional[date] = None
    vencimento_tpi: Optional[date] = None
    obs: Optional[str] = None

    model_config = ConfigDict(extra="forbid")
