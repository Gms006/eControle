from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class IngestSource(BaseModel):
    type: str = Field(..., description="e.g. spreadsheet_export")
    name: str | None = None
    version: str | None = None
    generated_at: datetime | None = None


class IngestOrg(BaseModel):
    slug: str | None = None


class IngestResult(BaseModel):
    dataset: str
    inserted: int
    updated: int
    total: int
    ingest_run_id: str
