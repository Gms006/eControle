from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LicenceFileEvent(Base):
    __tablename__ = "licence_file_events"

    __table_args__ = (
        UniqueConstraint("org_id", "company_id", "hash", name="uq_licence_file_events_org_company_hash"),
        Index("ix_licence_file_events_org_id", "org_id"),
        Index("ix_licence_file_events_company_id", "company_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column("hash", String(64), nullable=False)
    detected_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detected_expiry: Mapped[date | None] = mapped_column(Date(), nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="processed", server_default="processed")
    error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

