from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginatedResponse


class AlertaView(BaseModel):
    alerta_id: str
    org_id: UUID
    empresa_id: int
    empresa: str
    cnpj: str
    tipo_alerta: str
    descricao: str
    validade: date | None = None
    dias_restantes: int | None = None

    model_config = ConfigDict(from_attributes=True)


class AlertaListResponse(PaginatedResponse[AlertaView]):
    pass


class AlertaTrendItem(BaseModel):
    mes: date
    alertas_vencendo: int
    alertas_vencidas: int
    total_alertas: int

    model_config = ConfigDict(from_attributes=True)


class AlertaTrendResponse(BaseModel):
    items: list[AlertaTrendItem]
