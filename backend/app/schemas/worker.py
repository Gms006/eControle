from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class WorkerHealthResponse(BaseModel):
    status: str = "ok"
    db: str
    backend: str
    jobs_supported: list[str] = Field(default_factory=list)
    watchers_supported: list[str] = Field(default_factory=list)
    active_jobs: int = 0
    last_job_started_at: datetime | None = None


class WorkerJobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    source: str
    status: str
    total: int = 0
    processed: int = 0
    ok_count: int = 0
    error_count: int = 0
    skipped_count: int = 0
    current_cnpj: str | None = None
    current_company_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    errors: list[dict] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict)
