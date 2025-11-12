from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginatedResponse


class AgendamentoItem(BaseModel):
    id: int
    org_id: UUID
    empresa_id: Optional[int] = None
    titulo: str
    descricao: Optional[str] = None
    inicio: datetime
    fim: Optional[datetime] = None
    tipo: Optional[str] = None
    situacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AgendamentoListResponse(PaginatedResponse[AgendamentoItem]):
    pass
