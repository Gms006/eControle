from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CNAERisk(Base):
    __tablename__ = "cnae_risks"

    __table_args__ = (
        UniqueConstraint("cnae_code", name="uq_cnae_risks_cnae_code"),
        Index("ix_cnae_risks_cnae_code", "cnae_code"),
        Index("ix_cnae_risks_is_active", "is_active"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cnae_code: Mapped[str] = mapped_column(String(16), nullable=False)
    cnae_text: Mapped[str] = mapped_column(String(512), nullable=False)
    risk_tier: Mapped[str | None] = mapped_column(String(16), nullable=True)
    base_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sanitary_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    fire_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    environmental_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
