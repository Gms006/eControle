from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReceitaWSBulkSyncStartRequest(BaseModel):
    password: str = Field(min_length=1)
    dry_run: bool = True
    only_missing: bool = True


class ReceitaWSBulkSyncStartResponse(BaseModel):
    run_id: str


class ReceitaWSBulkSyncStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: str
    org_id: str
    started_by_user_id: str
    status: str
    dry_run: bool
    only_missing: bool
    total: int
    processed: int
    ok_count: int
    error_count: int
    skipped_count: int
    current_cnpj: str | None = None
    current_company_id: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    errors: list[dict] = Field(default_factory=list)
    changes_summary: dict = Field(default_factory=dict)


class ReceitaWSBulkSyncCancelResponse(BaseModel):
    run_id: str
    status: str
