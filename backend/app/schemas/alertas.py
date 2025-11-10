from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginatedResponse


class AlertaView(BaseModel):
    alerta_id: int
    empresa_id: int
    org_id: UUID
    empresa: str
    cnpj: str
    tipo_alerta: str
    descricao: str
    validade: Optional[date] = None
    dias_restantes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AlertaListResponse(PaginatedResponse[AlertaView]):
    pass
