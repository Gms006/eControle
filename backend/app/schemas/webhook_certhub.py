from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class WebhookMode(str, Enum):
    upsert = "upsert"
    full = "full"
    delete = "delete"


class CertHubWebhookPayload(BaseModel):
    mode: WebhookMode
    org_slug: str
    certificates: Optional[list[dict]] = None
    deleted_cert_ids: Optional[list[str]] = None

    model_config = ConfigDict(extra="allow")
