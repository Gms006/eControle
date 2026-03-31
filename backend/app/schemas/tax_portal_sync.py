from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TaxPortalSyncStartRequest(BaseModel):
    password: str = Field(min_length=1)
    dry_run: bool = True
    municipio: str = Field(default="anapolis", min_length=1, max_length=128)
    limit: int | None = Field(default=None, ge=1, le=500)


class TaxPortalSyncStartResponse(BaseModel):
    run_id: str


class TaxPortalSyncStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: str
    org_id: str
    started_by_user_id: str | None = None
    status: str
    trigger_type: str
    dry_run: bool
    municipio: str | None = None
    limit: int | None = None

    total: int
    processed: int
    ok_count: int
    error_count: int
    skipped_count: int
    relogin_count: int

    current_cnpj: str | None = None
    current_company_id: str | None = None

    started_at: datetime
    finished_at: datetime | None = None

    errors: list[dict] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)


class TaxPortalSyncCancelResponse(BaseModel):
    run_id: str
    status: str
