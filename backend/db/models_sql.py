"""SQLAlchemy models for the eControle schema v1."""
from __future__ import annotations

import enum
import os
from pathlib import Path
from typing import Dict

import yaml
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

CONFIG_DEFAULT_PATH = Path(__file__).resolve().parents[1] / "config.yaml"
_config_env = os.getenv("CONFIG_PATH")
if _config_env:
    _config_path = Path(_config_env)
    if not _config_path.is_absolute():
        _config_path = (Path(__file__).resolve().parents[1] / _config_env).resolve()
else:
    _config_path = CONFIG_DEFAULT_PATH

CONFIG_PATH = _config_path

with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
    CONFIG_DATA = yaml.safe_load(config_file)

ENUM_VALUES: Dict[str, list[str]] = CONFIG_DATA.get("enums", {})

ENUM_NAME_MAP = {
    "situacao_processos": "situacao_processo_enum",
    "operacoes_diversos": "operacao_diversos_enum",
    "orgaos_diversos": "orgao_diversos_enum",
    "alvaras_funcionamento": "alvara_funcionamento_enum",
    "servicos_sanitarios": "servico_sanitario_enum",
    "notificacoes_sanitarias": "notificacao_sanitaria_enum",
    "categorias_contato": "categoria_contato_enum",
}


def pg_enum(enum_key: str) -> PGEnum:
    values = ENUM_VALUES.get(enum_key)
    if not values:
        raise KeyError(f"Enum '{enum_key}' not found in config.yaml")
    return PGEnum(*values, name=ENUM_NAME_MAP[enum_key], create_type=False)


class ResponsavelFiscalEnum(str, enum.Enum):
    CARLA = "CARLA"
    DENISE = "DENISE"
    FERNANDO = "FERNANDO"


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    empresa = Column(String(255), nullable=False)
    cnpj = Column(String(14), nullable=False)
    porte = Column(String(50))
    municipio = Column(String(120), nullable=False)
    status_empresas = Column(String(50), nullable=False, default="Ativa")
    categoria = Column(String(120))
    ie = Column(String(50))
    im = Column(String(50))
    inscricao_municipal = Column(String(50))
    inscricao_estadual = Column(String(50))
    situacao = Column(String(120))
    debito = Column(String(120))
    certificado = Column(String(120))
    obs = Column(Text)
    proprietario = Column(String(255))
    cpf = Column(String(14))
    telefone = Column(String(60))
    email = Column(String(255))
    responsavel = Column(String(255))
    responsavel_legal = Column(String(255))
    cpf_responsavel_legal = Column(String(14))
    responsavel_fiscal = Column(
        SAEnum(ResponsavelFiscalEnum, name="responsavel_fiscal_enum", create_type=False),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    licencas = relationship("Licenca", back_populates="empresa", cascade="all, delete-orphan")
    taxas = relationship("Taxa", back_populates="empresa", cascade="all, delete-orphan")
    processos = relationship("Processo", back_populates="empresa", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("cnpj", name="uq_empresas_cnpj"),
        Index("idx_empresas_municipio", "municipio"),
    )


class Licenca(Base):
    __tablename__ = "licencas"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(50), nullable=False)
    tipo_codigo = Column(Text, ForeignKey("licenca_tipos.codigo"))
    status = Column(String(120), nullable=False)
    validade = Column(Date)
    obs = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    empresa = relationship("Empresa", back_populates="licencas")

    __table_args__ = (
        Index("idx_licencas_empresa_tipo", "empresa_id", "tipo"),
        Index("idx_licencas_validade", "validade"),
    )


class Taxa(Base):
    __tablename__ = "taxas"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(50), nullable=False)
    status = Column(String(120), nullable=False)
    data_envio = Column(Date)
    obs = Column(Text)
    vencimento_tpi = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    empresa = relationship("Empresa", back_populates="taxas")

    __table_args__ = (
        Index("idx_taxas_empresa_tipo", "empresa_id", "tipo"),
        Index("idx_taxas_status", "status"),
    )


class Processo(Base):
    __tablename__ = "processos"

    id = Column(Integer, primary_key=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(50), nullable=False)
    protocolo = Column(String(120), nullable=True)
    data_solicitacao = Column(Date, nullable=True)
    situacao = Column(pg_enum("situacao_processos"), nullable=False)
    status_padrao = Column(String(120))
    obs = Column(Text)
    prazo = Column(Date)
    operacao = Column(pg_enum("operacoes_diversos"), nullable=True)
    orgao = Column(pg_enum("orgaos_diversos"), nullable=True)
    alvara = Column(pg_enum("alvaras_funcionamento"), nullable=True)
    municipio = Column(String(120))
    tpi = Column(String(120))
    inscricao_imobiliaria = Column(String(120))
    servico = Column(pg_enum("servicos_sanitarios"), nullable=True)
    taxa = Column(String(120))
    notificacao = Column(pg_enum("notificacoes_sanitarias"), nullable=True)
    data_val = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    empresa = relationship("Empresa", back_populates="processos")

    __table_args__ = (
        UniqueConstraint("protocolo", "tipo", name="uq_processos_protocolo_tipo"),
        Index("idx_processos_empresa_tipo", "empresa_id", "tipo"),
        Index("idx_processos_situacao", "situacao"),
        Index("idx_processos_prazo", "prazo"),
    )


class Contato(Base):
    __tablename__ = "contatos"

    id = Column(Integer, primary_key=True)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    contato = Column(String(255), nullable=False)
    municipio = Column(String(120))
    telefone = Column(String(60))
    whatsapp = Column(String(10), nullable=False, server_default=text("'NÃO'"))
    email = Column(String(255))
    categoria = Column(pg_enum("categorias_contato"), nullable=False)
    obs = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_contatos_categoria", "categoria"),
        Index("idx_contatos_org_nome", "org_id", func.lower(func.immutable_unaccent(contato))),
        Index("idx_contatos_org_email", "org_id", func.lower(email)),
    )


class Modelo(Base):
    __tablename__ = "modelos"

    id = Column(Integer, primary_key=True)
    org_id = Column(UUID(as_uuid=False), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    modelo = Column(Text, nullable=False)
    descricao = Column(String(255))
    utilizacao = Column(String(120), nullable=False, default="WhatsApp")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_modelos_utilizacao", "utilizacao"),
        Index("idx_modelos_org_titulo", "org_id", func.lower(func.immutable_unaccent(modelo))),
    )
