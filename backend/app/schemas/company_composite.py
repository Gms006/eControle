from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.fs_dirname import normalize_fs_dirname


class CompositeCompany(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    fs_dirname: Optional[str] = None
    municipio: Optional[str] = None
    uf: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("fs_dirname")
    @classmethod
    def validate_fs_dirname(cls, value: Optional[str]) -> Optional[str]:
        return normalize_fs_dirname(value)


class CompositeProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inscricao_municipal: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    porte: Optional[str] = None
    categoria: Optional[str] = None
    proprietario_principal: Optional[str] = None
    cpf: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    responsavel_fiscal: Optional[str] = None
    observacoes: Optional[str] = None
    cnaes_principal: Optional[list[dict]] = None
    cnaes_secundarios: Optional[list[dict]] = None
    mei: bool = False
    endereco_fiscal: bool = False


class CompositeLicences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alvara_sanitario: bool = False
    alvara_funcionamento: bool = False
    cercon: bool = False
    licenca_ambiental: bool = False
    certidao_uso_solo: bool = False
    nao_necessita: bool = False


class CompositeTaxes(BaseModel):
    model_config = ConfigDict(extra="forbid")
    funcionamento: bool = False
    publicidade: bool = False
    vigilancia_sanitaria: bool = False
    localizacao_instalacao: bool = False
    ocupacao_area_publica: bool = False
    tpi: bool = False
    vencimento_tpi: Optional[str] = None  # dd/mm


class CompanyCompositeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company: CompositeCompany
    profile: CompositeProfile
    licences: Optional[CompositeLicences] = None
    taxes: Optional[CompositeTaxes] = None
