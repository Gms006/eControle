from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.ingest.common import IngestOrg, IngestSource
from app.schemas.ingest.licences import LicenceIngestItem
from app.schemas.ingest.processes import ProcessIngestItem
from app.schemas.ingest.taxes import TaxIngestItem


class LicencesIngestEnvelope(BaseModel):
    source: IngestSource
    org: IngestOrg | None = None
    source_hash: Optional[str] = None
    licences: list[LicenceIngestItem] = Field(default_factory=list)


class TaxesIngestEnvelope(BaseModel):
    source: IngestSource
    org: IngestOrg | None = None
    source_hash: Optional[str] = None
    taxes: list[TaxIngestItem] = Field(default_factory=list)


class ProcessesIngestEnvelope(BaseModel):
    source: IngestSource
    org: IngestOrg | None = None
    source_hash: Optional[str] = None
    processes: list[ProcessIngestItem] = Field(default_factory=list)
