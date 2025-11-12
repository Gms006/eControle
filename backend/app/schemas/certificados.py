from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginatedResponse


class CertificadoView(BaseModel):
    cert_id: int
    empresa_id: Optional[int] = None
    org_id: UUID
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    valido_de: Optional[date] = None
    valido_ate: Optional[date] = None
    dias_restantes: Optional[int] = None
    situacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CertificadoListResponse(PaginatedResponse[CertificadoView]):
    pass
