from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationOperationalScanRun(Base):
    __tablename__ = "notification_operational_scan_runs"

    __table_args__ = (
        Index("ix_notification_operational_scan_runs_org_id", "org_id"),
        Index("ix_notification_operational_scan_runs_status", "status"),
        Index("ix_notification_operational_scan_runs_started_at", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    started_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    emitted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deduped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(800), nullable=True)
