from __future__ import annotations

from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class Certificado(Base):
    __tablename__ = "certificados"

    id = Column(BigInteger, primary_key=True)
    org_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True, index=True)
    arquivo = Column(String(512), nullable=True)
    caminho = Column(String(1024), nullable=True)
    serial = Column(String(128), nullable=True)
    sha1 = Column(String(128), nullable=True)
    subject = Column(String(1024), nullable=True)
    issuer = Column(String(1024), nullable=True)
    valido_de = Column(Date, nullable=True)
    valido_ate = Column(Date, nullable=True)
    senha = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa", lazy="joined", viewonly=True)
