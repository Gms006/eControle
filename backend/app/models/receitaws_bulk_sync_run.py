from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReceitaWSBulkSyncRun(Base):
    __tablename__ = "receitaws_bulk_sync_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False, index=True)
    started_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(24), nullable=False, server_default="queued", index=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    only_missing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))

    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    ok_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    current_cnpj: Mapped[str | None] = mapped_column(String(18), nullable=True)
    current_company_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    errors: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    changes_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
