from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Index, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CompanyTax(Base):
    __tablename__ = "company_taxes"

    __table_args__ = (
        UniqueConstraint("org_id", "company_id", name="uq_company_taxes_org_company"),
        Index("ix_company_taxes_org_id", "org_id"),
        Index("ix_company_taxes_company_id", "company_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)

    data_envio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_funcionamento: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_publicidade: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_vig_sanitaria: Mapped[str | None] = mapped_column(String(128), nullable=True)
    iss: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_localiz_instalacao: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_ocup_area_publica: Mapped[str | None] = mapped_column(String(128), nullable=True)
    taxa_bombeiros: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tpi: Mapped[str | None] = mapped_column(String(128), nullable=True)
    vencimento_tpi: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status_taxas: Mapped[str | None] = mapped_column(String(64), nullable=True)

    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

