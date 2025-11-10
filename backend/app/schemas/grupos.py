from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginatedResponse


class GrupoKPIView(BaseModel):
    org_id: UUID
    grupo: str
    chave: str
    valor_nome: str
    valor: int

    model_config = ConfigDict(from_attributes=True)


class GrupoKPIListResponse(PaginatedResponse[GrupoKPIView]):
    pass
