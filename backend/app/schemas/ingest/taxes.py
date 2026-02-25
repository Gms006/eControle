from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TaxIngestItem(BaseModel):
    cnpj: str
    data_envio: Optional[str] = None
    taxa_funcionamento: Optional[str] = None
    taxa_publicidade: Optional[str] = None
    taxa_vig_sanitaria: Optional[str] = None
    iss: Optional[str] = None
    taxa_localiz_instalacao: Optional[str] = None
    taxa_ocup_area_publica: Optional[str] = None
    taxa_bombeiros: Optional[str] = None
    tpi: Optional[str] = None
    vencimento_tpi: Optional[str] = None
    status_taxas: Optional[str] = None
    raw: Optional[dict] = None

