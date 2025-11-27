from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CndView(BaseModel):
    id: int
    org_id: UUID
    empresa_id: Optional[int] = None
    cnpj: Optional[str] = None
    esfera: str
    orgao: str
    status: str
    url: Optional[str] = None
    data_emissao: Optional[date] = None
    validade: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
