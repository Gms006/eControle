from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class PageMeta(BaseModel):
    total: int
    page: int
    size: int


class RequerimentoFile(BaseModel):
    id: str
    nome: str
    tipo: Optional[str] = None
    municipio: Optional[str] = None
    relpath: str
    ext: str
    mtime: float


class RequerimentoListResponse(BaseModel):
    items: List[RequerimentoFile]
    total: int
    page: int
    size: int


class Contato(BaseModel):
    id: int
    contato: str
    municipio: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = Field(None, alias="e_mail")
    categoria: str


class ContatoListResponse(BaseModel):
    items: List[Contato]
    total: int
    page: int
    size: int


class Modelo(BaseModel):
    id: int
    modelo: str
    descricao: Optional[str] = None
    utilizacao: Optional[str] = None


class ModeloListResponse(BaseModel):
    items: List[Modelo]
    total: int
    page: int
    size: int
