from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class CompanyLicenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str
    municipio: Optional[str] = None
    alvara_vig_sanitaria: Optional[str] = None
    cercon: Optional[str] = None
    alvara_funcionamento: Optional[str] = None
    licenca_ambiental: Optional[str] = None
    certidao_uso_solo: Optional[str] = None
    raw: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
