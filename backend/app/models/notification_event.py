from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    __table_args__ = (
        UniqueConstraint("org_id", "dedupe_key", name="uq_notification_events_org_dedupe_key"),
        Index("ix_notification_events_org_read_created", "org_id", "read_at", "created_at"),
        Index("ix_notification_events_org_created", "org_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    route_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
