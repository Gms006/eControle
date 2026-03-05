import uuid

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class CertificateMirror(Base):
    __tablename__ = "certificate_mirror"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)

    # Vinculo com company quando document_type == CNPJ e mapeamento por digitos bater.
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

    # IDs do CertHub / identificadores.
    cert_id = Column(String(80), nullable=True)
    sha1_fingerprint = Column(String(60), nullable=True)
    serial_number = Column(String(120), nullable=True)

    # Titular / emissor.
    name = Column(String(240), nullable=True)
    cn = Column(String(240), nullable=True)
    issuer_cn = Column(String(240), nullable=True)

    # Documento (CNPJ/CPF).
    document_type = Column(String(16), nullable=True)
    document_digits = Column(String(32), nullable=True)
    document_masked = Column(String(32), nullable=True)

    # Validade/parse.
    parse_ok = Column(Boolean, nullable=False, server_default="true")
    not_before = Column(DateTime(timezone=True), nullable=True)
    not_after = Column(DateTime(timezone=True), nullable=True)
    last_ingested_at = Column(DateTime(timezone=True), nullable=True)

    raw = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("org_id", "sha1_fingerprint", name="uq_certificate_mirror_org_sha1"),
        Index("ix_certificate_mirror_org_not_after", "org_id", "not_after"),
        Index("ix_certificate_mirror_org_document_digits", "org_id", "document_digits"),
        Index("ix_certificate_mirror_org_company_id", "org_id", "company_id"),
    )
