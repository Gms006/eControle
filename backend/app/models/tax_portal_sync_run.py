from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.db.base import Base
from app.core.normalization import normalize_municipio


class TaxPortalSyncRun(Base):
    __tablename__ = "tax_portal_sync_runs"

    __table_args__ = (
        Index("ix_tax_portal_sync_runs_org_id", "org_id"),
        Index("ix_tax_portal_sync_runs_status", "status"),
        Index("ix_tax_portal_sync_runs_started_at", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    started_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    trigger_type: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")

    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    municipio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ok_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    relogin_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    current_cnpj: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_company_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("companies.id"), nullable=True)

    errors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @validates("municipio")
    def _normalize_municipio_value(self, _key: str, value: str | None) -> str | None:
        return normalize_municipio(value)
