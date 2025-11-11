from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class ProcessoView(BaseModel):
    processo_id: int = Field(..., description="Identificador do processo")
    empresa_id: int
    org_id: UUID
    empresa: str
    cnpj: str
    tipo: str
    protocolo: Optional[str] = None
    data_solicitacao: Optional[date] = None
    situacao: str
    status_padrao: Optional[str] = None
    prazo: Optional[date] = None
    status_cor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProcessoListResponse(PaginatedResponse[ProcessoView]):
    pass


class ProcessoBase(BaseModel):
    empresa_id: int
    tipo: str
    protocolo: Optional[str] = None
    data_solicitacao: Optional[date] = None
    situacao: str
    status_padrao: Optional[str] = None
    prazo: Optional[date] = None
    obs: Optional[str] = None
    operacao: Optional[str] = None
    orgao: Optional[str] = None
    alvara: Optional[str] = None
    municipio: Optional[str] = None
    tpi: Optional[str] = None
    inscricao_imobiliaria: Optional[str] = None
    servico: Optional[str] = None
    taxa: Optional[str] = None
    notificacao: Optional[str] = None
    data_val: Optional[date] = None

    model_config = ConfigDict(extra="forbid")


class ProcessoCreate(ProcessoBase):
    pass


class ProcessoUpdate(BaseModel):
    tipo: Optional[str] = None
    protocolo: Optional[str] = None
    data_solicitacao: Optional[date] = None
    situacao: Optional[str] = None
    status_padrao: Optional[str] = None
    prazo: Optional[date] = None
    obs: Optional[str] = None
    operacao: Optional[str] = None
    orgao: Optional[str] = None
    alvara: Optional[str] = None
    municipio: Optional[str] = None
    tpi: Optional[str] = None
    inscricao_imobiliaria: Optional[str] = None
    servico: Optional[str] = None
    taxa: Optional[str] = None
    notificacao: Optional[str] = None
    data_val: Optional[date] = None

    model_config = ConfigDict(extra="forbid")
