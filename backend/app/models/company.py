import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"

    __table_args__ = (
        UniqueConstraint("org_id", "cnpj", name="uq_companies_org_cnpj"),
        Index("ix_companies_org_id", "org_id"),
        Index("ix_companies_org_id_cnpj", "org_id", "cnpj"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(18), nullable=False)
    razao_social: Mapped[str] = mapped_column(String(255), nullable=False)
    nome_fantasia: Mapped[str | None] = mapped_column(String(255), nullable=True)
    municipio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"), default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
    # Relationship to CompanyProfile
    profile: Mapped["CompanyProfile | None"] = relationship(
        "CompanyProfile",
        uselist=False,
        foreign_keys="CompanyProfile.company_id",
        primaryjoin="and_(Company.id==foreign(CompanyProfile.company_id), Company.org_id==foreign(CompanyProfile.org_id))",
    )