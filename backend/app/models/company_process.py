from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, Index, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CompanyProcess(Base):
    __tablename__ = "company_processes"

    __table_args__ = (
        UniqueConstraint("org_id", "company_id", "process_type", "protocolo", name="uq_company_processes_natkey"),
        Index("ix_company_processes_org_id", "org_id"),
        Index("ix_company_processes_company_id", "company_id"),
        Index("ix_company_processes_type", "process_type"),
        Index("ix_company_processes_protocolo", "protocolo"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)

    process_type: Mapped[str] = mapped_column(String(64), nullable=False)
    protocolo: Mapped[str] = mapped_column(String(128), nullable=False)

    municipio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    orgao: Mapped[str | None] = mapped_column(String(128), nullable=True)
    operacao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data_solicitacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    situacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    obs: Mapped[str | None] = mapped_column(Text, nullable=True)

    extra: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

