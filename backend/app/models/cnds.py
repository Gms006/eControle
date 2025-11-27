from __future__ import annotations

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class Cnd(Base):
    __tablename__ = "cnds"

    id = Column(Integer, primary_key=True)
    org_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True, index=True)
    cnpj = Column(String(14), nullable=True)
    esfera = Column(String, nullable=False)
    orgao = Column(String, nullable=False)
    status = Column(String, nullable=False)
    url = Column(String, nullable=True)
    data_emissao = Column(Date, nullable=True)
    validade = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
