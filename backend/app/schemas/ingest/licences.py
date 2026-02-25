from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LicenceIngestItem(BaseModel):
    cnpj: str
    municipio: Optional[str] = None
    alvara_vig_sanitaria: Optional[str] = None
    cercon: Optional[str] = None
    alvara_funcionamento: Optional[str] = None
    licenca_ambiental: Optional[str] = None
    certidao_uso_solo: Optional[str] = None
    raw: Optional[dict] = None

