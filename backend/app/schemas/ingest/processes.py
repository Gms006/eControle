from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ProcessIngestItem(BaseModel):
    cnpj: str
    process_type: str
    protocolo: str
    municipio: Optional[str] = None
    orgao: Optional[str] = None
    operacao: Optional[str] = None
    data_solicitacao: Optional[str] = None
    situacao: Optional[str] = None
    obs: Optional[str] = None
    extra: Optional[dict] = None
    raw: Optional[dict] = None

