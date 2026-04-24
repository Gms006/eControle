from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, Index, func, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.regulatory import (
    DEFAULT_ADDRESS_LOCATION_TYPE,
    DEFAULT_ADDRESS_USAGE_TYPE,
    DEFAULT_SANITARY_COMPLEXITY,
)
from app.db.base import Base


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    __table_args__ = (
        UniqueConstraint("org_id", "company_id", name="uq_company_profiles_org_company"),
        Index("ix_company_profiles_org_id", "org_id"),
        Index("ix_company_profiles_company_id", "company_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)

    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    porte: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status_empresa: Mapped[str | None] = mapped_column(String(64), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(128), nullable=True)
    inscricao_estadual: Mapped[str | None] = mapped_column(String(64), nullable=True)
    inscricao_municipal: Mapped[str | None] = mapped_column(String(64), nullable=True)
    situacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    certificado_digital: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    proprietario_principal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cpf: Mapped[str | None] = mapped_column(String(32), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(512), nullable=True)
    responsavel_fiscal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cnaes_principal: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    cnaes_secundarios: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    risco_consolidado: Mapped[str | None] = mapped_column(String(16), nullable=True)
    score_urgencia: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    score_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sanitary_complexity: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DEFAULT_SANITARY_COMPLEXITY, server_default=DEFAULT_SANITARY_COMPLEXITY
    )
    address_usage_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DEFAULT_ADDRESS_USAGE_TYPE, server_default=DEFAULT_ADDRESS_USAGE_TYPE
    )
    address_location_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DEFAULT_ADDRESS_LOCATION_TYPE, server_default=DEFAULT_ADDRESS_LOCATION_TYPE
    )
    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
