from __future__ import annotations

import logging
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import DefaultDict, Iterable, List, Optional, Sequence
from uuid import UUID

from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from db.models_sql import Empresa, Licenca, Processo

logger = logging.getLogger(__name__)

EMPRESAS_ROOT_ENV = "EMPRESAS_ROOT_DIR"
DEFAULT_EMPRESAS_ROOT = Path(r"G:\EMPRESAS")
LICENSE_DIR_PARTS = ["Societário", "Alvarás e Certidões"]

ALLOWED_EXTS = {".pdf", ".jpg", ".jpeg", ".png"}


@dataclass
class DocumentoArquivo:
    path: Path
    categoria: str
    tipo_documento: str
    validade: Optional[date]
    status_bruto: Optional[str]


@dataclass
class InterpretedLicenca:
    categoria: str
    status: str
    status_bruto: Optional[str]
    tipo_documento: str
    validade: Optional[date]
    arquivo: Optional[str]
    caminho: Optional[str]
    fonte: str = "ARQUIVO"


_SUFFIXES_CLEAN = (" - filial", " - matriz", " - sede")
_DATE_REGEX = re.compile(r"(?i)(\d{2})[./-](\d{2})[./-](\d{4})")


_PATTERN_DEFINITIONS: Sequence[tuple[str, re.Pattern[str], str]] = (
    (
        "ALVARÁ BOMBEIROS",
        re.compile(
            r"(?i)^alvar[aá]\s*bombeiros(?:\s*-\s*(?P<tipo>definitivo|provis[óo]rio|condicionado))?(?:\s*-\s*(?:val\s*)?(?P<data>\d{2}[./-]\d{2}[./-]\d{4}))?"
        ),
        "Definitivo",
    ),
    (
        "ALVARÁ VIG SANITÁRIA",
        re.compile(
            r"(?i)^(dispensa\s+(ambiental\s+e\s+)?sanit[áa]ria|alvar[aá]\s+vig\s+sanit[áa]ria)(?:\s*-\s*(?P<tipo>provis[óo]rio|condicionado|definitivo|dispensa))?(?:\s*-\s*(?:val\s*)?(?P<data>\d{2}[./-]\d{2}[./-]\d{4}))?"
        ),
        "Definitivo",
    ),
    (
        "ALVARÁ FUNCIONAMENTO",
        re.compile(
            r"(?i)^alvar[aá]\s+funcionamento(?:\s*-\s*(?P<tipo>provis[óo]rio|condicionado|definitivo))?(?:\s*-\s*(?:val\s*)?(?P<data>\d{2}[./-]\d{2}[./-]\d{4}))?"
        ),
        "Definitivo",
    ),
    (
        "CERTIDÃO USO DO SOLO",
        re.compile(
            r"(?i)^uso\s+do\s+solo(?:\s*-\s*(?P<tipo>definitivo))?(?:\s*-\s*(?:val\s*)?(?P<data>\d{2}[./-]\d{2}[./-]\d{4}))?"
        ),
        "Definitivo",
    ),
    (
        "LICENÇA AMBIENTAL",
        re.compile(
            r"(?i)^(licen[cç]a\s+ambiental|dispensa\s+ambiental)(?:\s*-\s*(?P<tipo>provis[óo]rio|condicionado|definitivo|dispensa))?(?:\s*-\s*(?:val\s*)?(?P<data>\d{2}[./-]\d{2}[./-]\d{4}))?"
        ),
        "Definitivo",
    ),
)


_CATEGORIAS_BASE = {categoria for categoria, _, _ in _PATTERN_DEFINITIONS}

_SUJEITO_ALWAYS = {
    "ALVARÁ FUNCIONAMENTO",
    "ALVARÁ BOMBEIROS",
    "CERTIDÃO USO DO SOLO",
}

_ISENTO_SENSITIVE = {
    "ALVARÁ VIG SANITÁRIA",
    "LICENÇA AMBIENTAL",
}


def _normalize_empresa_nome(nome: str) -> str:
    normalized = nome.strip().upper()
    for suffix in _SUFFIXES_CLEAN:
        if normalized.lower().endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    return normalized.strip()


def _empresa_dir(root: Path, empresa_nome: str) -> Path:
    normalized = _normalize_empresa_nome(empresa_nome)
    return root / normalized / Path(*LICENSE_DIR_PARTS)


def _extract_date(value: str | None) -> Optional[date]:
    if not value:
        return None
    match = _DATE_REGEX.search(value)
    if not match:
        return None
    try:
        parsed = datetime.strptime("/".join(match.groups()), "%d/%m/%Y").date()
    except ValueError:
        return None
    return parsed


def _buscar_arquivos_validos(base_dir: Path, empresa_municipio: str | None) -> list[Path]:
    if not base_dir.exists() or not base_dir.is_dir():
        return []

    arquivos = [
        file
        for file in base_dir.iterdir()
        if file.is_file() and file.suffix.lower() in ALLOWED_EXTS
    ]
    if arquivos:
        return arquivos

    candidatos: list[Path] = []
    municipio_lower = (empresa_municipio or "").lower()
    for subdir in base_dir.iterdir():
        if not subdir.is_dir():
            continue
        nome = subdir.name.lower()
        if "filial" in nome or "matriz" in nome or (municipio_lower and municipio_lower in nome):
            candidatos.append(subdir)

    if not candidatos:
        candidatos = [p for p in base_dir.iterdir() if p.is_dir()]

    arquivos = []
    for subdir in candidatos:
        arquivos.extend(
            [
                file
                for file in subdir.rglob("*")
                if file.is_file() and file.suffix.lower() in ALLOWED_EXTS
            ]
        )
    return arquivos


def _identificar_documento(path: Path) -> Optional[DocumentoArquivo]:
    nome = path.stem
    for categoria, pattern, default_tipo in _PATTERN_DEFINITIONS:
        match = pattern.search(nome)
        if not match:
            continue
        tipo_raw = match.group("tipo")
        tipo_documento = (tipo_raw or default_tipo).title()
        validade = _extract_date(match.group("data"))
        status_bruto = None
        if tipo_documento.lower() == "dispensa":
            status_bruto = f"Dispensa. Val {validade.strftime('%d/%m/%Y') if validade else ''}".strip()
        elif validade:
            status_bruto = f"Val {validade.strftime('%d/%m/%Y')}"
        else:
            status_bruto = tipo_documento
        return DocumentoArquivo(
            path=path,
            categoria=categoria,
            tipo_documento=tipo_documento,
            validade=validade,
            status_bruto=status_bruto,
        )
    return None


def _interpretar_documentos(documentos: Iterable[DocumentoArquivo]) -> list[InterpretedLicenca]:
    agrupado: DefaultDict[str, list[DocumentoArquivo]] = defaultdict(list)
    for doc in documentos:
        agrupado[doc.categoria].append(doc)

    hoje = date.today()
    resultados: list[InterpretedLicenca] = []

    for categoria, docs in agrupado.items():
        definitivo = next((d for d in docs if d.tipo_documento.lower() == "definitivo"), None)
        if definitivo:
            resultados.append(
                InterpretedLicenca(
                    categoria=categoria,
                    status="POSSUI",
                    status_bruto="Definitivo",
                    tipo_documento="Definitivo",
                    validade=None,
                    arquivo=definitivo.path.name,
                    caminho=str(definitivo.path),
                )
            )
            continue

        dispensas = [d for d in docs if d.tipo_documento.lower() == "dispensa"]
        if dispensas:
            mais_recente = max(dispensas, key=lambda d: d.validade or date.min)
            resultados.append(
                InterpretedLicenca(
                    categoria=categoria,
                    status="DISPENSA",
                    status_bruto=mais_recente.status_bruto,
                    tipo_documento="Dispensa",
                    validade=mais_recente.validade,
                    arquivo=mais_recente.path.name,
                    caminho=str(mais_recente.path),
                )
            )
            continue

        datados = [d for d in docs if d.validade]
        if datados:
            mais_recente = max(datados, key=lambda d: d.validade or date.min)
            status = "POSSUI" if mais_recente.validade and mais_recente.validade >= hoje else "VENCIDO"
            status_bruto = (
                f"Possui. Val {mais_recente.validade.strftime('%d/%m/%Y')}"
                if status == "POSSUI"
                else f"Vencido. Val {mais_recente.validade.strftime('%d/%m/%Y')}"
            )
            resultados.append(
                InterpretedLicenca(
                    categoria=categoria,
                    status=status,
                    status_bruto=status_bruto,
                    tipo_documento=mais_recente.tipo_documento,
                    validade=mais_recente.validade,
                    arquivo=mais_recente.path.name,
                    caminho=str(mais_recente.path),
                )
            )
    return resultados


def _buscar_processos(db: Session, org_id: UUID, empresa_id: int, categoria: str) -> Optional[Processo]:
    stmt = (
        select(Processo)
        .where(
            and_(
                Processo.org_id == org_id,
                Processo.empresa_id == empresa_id,
                func.lower(Processo.tipo) == func.lower(categoria),
            )
        )
        .order_by(Processo.updated_at.desc())
    )
    return db.execute(stmt).scalars().first()


def _interpretar_processo(processo: Processo, categoria: str) -> Optional[InterpretedLicenca]:
    situacao = (processo.status_padrao or processo.situacao or "").strip()
    situacao_lower = situacao.lower()
    if not situacao or "pend" in situacao_lower:
        return None

    if any(word in situacao_lower for word in ("licenc", "conclu", "defer", "aprov")):
        status = "POSSUI"
        status_bruto = situacao or "Possui"
    else:
        status = situacao.title()
        status_bruto = situacao

    return InterpretedLicenca(
        categoria=categoria,
        status=status,
        status_bruto=status_bruto,
        tipo_documento="Processo",
        validade=None,
        arquivo=None,
        caminho=None,
        fonte="PROCESSO",
    )


def _should_skip_isento(existing: Licenca, categoria: str, tem_arquivo: bool) -> bool:
    if categoria not in _ISENTO_SENSITIVE:
        return False
    if tem_arquivo:
        return False
    status_atual = (existing.status or "").lower()
    return status_atual.startswith("isento")


def _should_protect_status(status: str | None) -> bool:
    if status is None:
        return False
    value = status.strip().upper()
    return value in {"*", "NÃO"}


def ingest_licencas_from_fs(db: Session, org_id: UUID | None = None, empresa_id: int | None = None) -> dict[str, int]:
    root_env = os.getenv(EMPRESAS_ROOT_ENV)
    root_dir = Path(root_env) if root_env else DEFAULT_EMPRESAS_ROOT

    empresas_query = select(Empresa).where(Empresa.municipio.isnot(None))
    if org_id:
        empresas_query = empresas_query.where(Empresa.org_id == org_id)
    if empresa_id:
        empresas_query = empresas_query.where(Empresa.id == empresa_id)

    empresas: List[Empresa] = list(db.execute(empresas_query).scalars())
    total_empresas = len(empresas)
    total_categorias = 0
    total_upsert = 0

    logger.info(
        "Iniciando ingestão de licenças: org_id=%s empresa_id=%s root=%s empresas=%s",
        org_id,
        empresa_id,
        root_dir,
        total_empresas,
    )

    for empresa in empresas:
        base_dir = _empresa_dir(root_dir, empresa.empresa)
        arquivos = _buscar_arquivos_validos(base_dir, empresa.municipio)
        documentos = filter(None, (_identificar_documento(arq) for arq in arquivos))
        interpretados = _interpretar_documentos(documentos)

        categorias = set(item.categoria for item in interpretados)
        categorias.update(_CATEGORIAS_BASE)

        for categoria in categorias:
            registro_arquivo = next((i for i in interpretados if i.categoria == categoria), None)

            if registro_arquivo:
                resultado = registro_arquivo
            else:
                processo = _buscar_processos(db, empresa.org_id, empresa.id, categoria)
                resultado = _interpretar_processo(processo, categoria) if processo else None

            if resultado is None:
                status = "SUJEITO"
                resultado = InterpretedLicenca(
                    categoria=categoria,
                    status=status,
                    status_bruto=status.title(),
                    tipo_documento="",
                    validade=None,
                    arquivo=None,
                    caminho=None,
                    fonte="PROCESSO",
                )

            stmt_existente = select(Licenca).where(
                Licenca.org_id == empresa.org_id,
                Licenca.empresa_id == empresa.id,
                func.lower(Licenca.tipo) == func.lower(categoria),
            )
            existente = db.execute(stmt_existente).scalars().first()

            if existente:
                if _should_protect_status(existente.status):
                    logger.debug(
                        "Ignorando overwrite por proteção: empresa_id=%s categoria=%s status_atual=%s",
                        empresa.id,
                        categoria,
                        existente.status,
                    )
                    continue

                if _should_skip_isento(existente, categoria, bool(registro_arquivo)):
                    logger.debug(
                        "Mantendo ISENTO existente: empresa_id=%s categoria=%s",
                        empresa.id,
                        categoria,
                    )
                    continue

                # UPDATE via SQL cru - só colunas que existem
                db.execute(
                    text(
                        """
                        UPDATE licencas
                        SET tipo     = :tipo,
                            status   = :status,
                            validade = :validade,
                            obs      = :obs
                            WHERE id = :id
                        """
                    ),
                    {
                        "id": existente.id,
                        "tipo": categoria,
                        "status": resultado.status,
                        "validade": resultado.validade,
                        "obs": resultado.status_bruto,
                    },
                )

            else:
                # INSERT via SQL cru - só colunas que existem
                db.execute(
                    text(
                        """
                        INSERT INTO licencas (
                            empresa_id, org_id, tipo, status,
                            validade, obs
                        ) VALUES (
                            :empresa_id, :org_id, :tipo, :status,
                            :validade, :obs
                        )
                        """
                    ),
                    {
                        "empresa_id": empresa.id,
                        "org_id": empresa.org_id,
                        "tipo": categoria,
                        "status": resultado.status,
                        "validade": resultado.validade,
                        "obs": resultado.status_bruto,
                    },
                )

            total_upsert += 1
            total_categorias += 1

        db.commit()

    logger.info(
        "Ingestão de licenças concluída: empresas=%s categorias=%s upserts=%s",
        total_empresas,
        total_categorias,
        total_upsert,
    )
    return {
        "empresas_processadas": total_empresas,
        "categorias_avaliadas": total_categorias,
        "licencas_upsertadas": total_upsert,
    }