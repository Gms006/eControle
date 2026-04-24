from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, Index, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.db.base import Base
from app.core.normalization import normalize_municipio
from app.core.regulatory import DEFAULT_ALVARA_FUNCIONAMENTO_KIND


class CompanyLicence(Base):
    __tablename__ = "company_licences"

    __table_args__ = (
        UniqueConstraint("org_id", "company_id", name="uq_company_licences_org_company"),
        Index("ix_company_licences_org_id", "org_id"),
        Index("ix_company_licences_company_id", "company_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)

    municipio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    alvara_vig_sanitaria: Mapped[str | None] = mapped_column(String(64), nullable=True)
    alvara_vig_sanitaria_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    cercon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cercon_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    alvara_funcionamento: Mapped[str | None] = mapped_column(String(64), nullable=True)
    alvara_funcionamento_kind: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DEFAULT_ALVARA_FUNCIONAMENTO_KIND, server_default=DEFAULT_ALVARA_FUNCIONAMENTO_KIND
    )
    alvara_funcionamento_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    licenca_ambiental: Mapped[str | None] = mapped_column(String(64), nullable=True)
    licenca_ambiental_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    certidao_uso_solo: Mapped[str | None] = mapped_column(String(64), nullable=True)
    certidao_uso_solo_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    motivo_nao_exigido: Mapped[str | None] = mapped_column(String(64), nullable=True)
    justificativa_nao_exigido: Mapped[str | None] = mapped_column(String(255), nullable=True)

    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @validates("municipio")
    def _normalize_municipio_value(self, _key: str, value: str | None) -> str | None:
        return normalize_municipio(value)
