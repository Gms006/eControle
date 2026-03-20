from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CNAERiskSuggestion(Base):
    __tablename__ = "cnae_risk_suggestions"

    __table_args__ = (
        Index("ix_cnae_risk_suggestions_org_id", "org_id"),
        Index("ix_cnae_risk_suggestions_cnae_code", "cnae_code"),
        Index("ix_cnae_risk_suggestions_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=True)
    cnae_code: Mapped[str] = mapped_column(String(16), nullable=False)

    suggested_risk_tier: Mapped[str | None] = mapped_column(String(16), nullable=True)
    suggested_base_weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggested_sanitary_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    suggested_fire_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    suggested_environmental_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)

    source_name: Mapped[str] = mapped_column(String(128), nullable=False)
    source_reference: Mapped[str | None] = mapped_column(String(512), nullable=True)
    evidence_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING", server_default="PENDING")
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
