from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class CompanyProcessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    company_id: str
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
    created_at: datetime
    updated_at: datetime
