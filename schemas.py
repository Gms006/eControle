from __future__ import annotations
from datetime import date
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, EmailStr, ConfigDict

from core.enums import (
    LicencaTipo, LicencaSituacao, AlvaraCategoria, TPIStatus, CertificadoDigital,
    TaxaTipo, TaxaSituacao,
    ProcessoOperacao, ProcessoSituacao, ProcessoServico, ProcessoNotificacao, ProcessoOrgao,
    ChecklistStatus,
)


# ======================
# Base / mixins
# ======================
class WithId(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID = Field(default_factory=uuid4)


# ======================
# Modelos
# ======================
class Empresa(WithId):
    razao_social: str
    cnpj_bruto: str = Field(description="14 dígitos, só números")
    cnpj_mascarado: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    cnae: Optional[str] = None
    categoria: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    endereco: Optional[str] = None
    situacao_fiscal: Optional[str] = Field(default=None, description="Sem Débitos | Possui Débitos")
    certificado_digital: Optional[CertificadoDigital] = None


class Licenca(WithId):
    id_empresa: UUID
    tipo: LicencaTipo
    situacao: LicencaSituacao
    validade: Optional[date] = None
    observacoes: Optional[str] = None


class Taxa(WithId):
    id_empresa: UUID
    tipo: TaxaTipo
    situacao: TaxaSituacao
    parcelas_pagas: Optional[int] = None
    parcelas_total: Optional[int] = None
    ano_inicial_aberto: Optional[int] = None
    ano_final_aberto: Optional[int] = None
    observacoes: Optional[str] = None


class Processo(WithId):
    id_empresa: UUID
    operacao: ProcessoOperacao
    orgao: ProcessoOrgao
    servico: Optional[ProcessoServico] = None
    alvara_categoria: Optional[AlvaraCategoria] = None
    tpi: Optional[TPIStatus] = None
    situacao: ProcessoSituacao
    notificacao: Optional[ProcessoNotificacao] = None
    data_entrada: Optional[date] = None
    data_protocolo: Optional[date] = None
    vencimento: Optional[date] = None
    observacoes: Optional[str] = None


class ChecklistItem(WithId):
    id_processo: UUID
    nome: str
    status: ChecklistStatus
    obrigatorio: bool = False
