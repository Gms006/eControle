from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IngestRun(Base):
    __tablename__ = "ingest_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False, index=True)
    dataset: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # e.g., "companies"

    source_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    source_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    status: Mapped[str] = mapped_column(String(24), nullable=False, server_default="SUCCESS")  # SUCCESS/FAILED
    # Use JSON for cross-dialect compatibility (tests run on SQLite in-memory)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
