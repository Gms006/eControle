from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class Agendamento(Base):
    __tablename__ = "agendamentos"

    id = Column(BigInteger, primary_key=True)
    org_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True, index=True)
    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)
    inicio = Column(DateTime(timezone=True), nullable=False, index=True)
    fim = Column(DateTime(timezone=True), nullable=True)
    tipo = Column(String(50), nullable=True)
    situacao = Column(String(50), nullable=True)
