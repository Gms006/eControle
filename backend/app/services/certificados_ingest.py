"""Rotinas de ingestão e persistência de certificados digitais."""

from __future__ import annotations

import logging
import os
import re
from typing import Dict, Iterable

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization.pkcs12 import (
    load_key_and_certificates,
)
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.certificados import Certificado

logger = logging.getLogger(__name__)


def _dotnet_serial_from_int(serial_number: int) -> str:
    hex_str = f"{serial_number:x}"
    if len(hex_str) % 2 == 1:
        hex_str = "0" + hex_str
    b = bytes.fromhex(hex_str)
    return b[::-1].hex().upper()


def extract_cert_info(cert_path: str, password: str | None) -> Dict[str, object]:
    """Extrai informações principais de um arquivo ``.pfx``."""

    with open(cert_path, "rb") as cert_file:
        cert_data = cert_file.read()

    pw = password.encode("utf-8") if password else None
    _, certificate, _ = load_key_and_certificates(cert_data, pw)
    if certificate is None:
        raise ValueError(f"Certificado ausente no arquivo: {cert_path}")

    subject = certificate.subject.rfc4514_string()
    issuer = certificate.issuer.rfc4514_string()
    valid_from = certificate.not_valid_before.date()
    valid_until = certificate.not_valid_after.date()
    thumbprint = certificate.fingerprint(hashes.SHA1()).hex().upper()
    serial = _dotnet_serial_from_int(certificate.serial_number)

    return {
        "subject": subject,
        "issuer": issuer,
        "valid_from": valid_from,
        "valid_until": valid_until,
        "thumbprint": thumbprint,
        "serial": serial,
    }


def upsert_certificado(cert_info: Dict[str, object], db_session: Session) -> Certificado:
    """Atualiza ou insere um certificado priorizando serial ou thumbprint."""

    org_id = cert_info["org_id"]
    serial = cert_info["serial"]
    sha1 = cert_info["thumbprint"]
    empresa_id = cert_info.get("empresa_id")

    certificados = (
        db_session.query(Certificado)
        .filter(
            Certificado.org_id == org_id,
            or_(Certificado.serial == serial, Certificado.sha1 == sha1),
        )
        .order_by(
            Certificado.valido_ate.desc(),
            Certificado.valido_de.desc(),
            Certificado.id.desc(),
        )
        .all()
    )

    certificado = certificados[0] if certificados else None
    if len(certificados) > 1:
        for dup in certificados[1:]:
            logger.info(
                "Removendo duplicata por serial/sha1: org_id=%s id=%s", org_id, dup.id
            )
            db_session.delete(dup)
        db_session.flush()

    if certificado:
        logger.info(
            "Atualizando certificado existente: serial=%s org_id=%s",
            serial,
            org_id,
        )
        certificado.org_id = org_id
        certificado.empresa_id = empresa_id
        certificado.arquivo = os.path.basename(cert_info["path"])
        certificado.caminho = cert_info["path"]
        certificado.serial = serial
        certificado.sha1 = sha1
        certificado.subject = cert_info["subject"]
        certificado.issuer = cert_info["issuer"]
        certificado.valido_de = cert_info["valid_from"]
        certificado.valido_ate = cert_info["valid_until"]
        certificado.senha = cert_info.get("senha")
    else:
        logger.info(
            "Inserindo novo certificado: serial=%s org_id=%s",
            serial,
            org_id,
        )
        certificado = Certificado(
            org_id=org_id,
            empresa_id=empresa_id,
            arquivo=os.path.basename(cert_info["path"]),
            caminho=cert_info["path"],
            serial=serial,
            sha1=sha1,
            subject=cert_info["subject"],
            issuer=cert_info["issuer"],
            valido_de=cert_info["valid_from"],
            valido_ate=cert_info["valid_until"],
            senha=cert_info.get("senha"),
        )
        db_session.add(certificado)

    db_session.commit()
    db_session.refresh(certificado)
    return certificado


def _iter_certificados(certificados_dir: str) -> Iterable[tuple[str, str | None]]:
    """Percorre somente a raiz do diretório retornando caminhos de ``.pfx``."""

    try:
        with os.scandir(certificados_dir) as it:
            for entry in it:
                if not entry.is_file():
                    continue
                filename = entry.name
                if not filename.lower().endswith(".pfx"):
                    continue
                password = _extract_password_from_filename(filename)
                yield entry.path, password or None
    except FileNotFoundError:
        logger.warning("Diretório de certificados não encontrado: %s", certificados_dir)


def _extract_password_from_filename(filename: str) -> str:
    m = re.search(r"senha\s*(.+?)\.pfx$", filename, flags=re.IGNORECASE)
    return m.group(1).strip() if m else ""


def cleanup_certificados_antigos(org_id: str, db_session: Session) -> int:
    """Remove certificados antigos/duplicados seguindo a regra do script legado."""

    removed = 0

    duplicate_serials = (
        db_session.query(Certificado.serial)
        .filter(Certificado.org_id == org_id, Certificado.serial.isnot(None))
        .group_by(Certificado.serial)
        .having(func.count(Certificado.id) > 1)
        .all()
    )

    for (serial,) in duplicate_serials:
        certificados = (
            db_session.query(Certificado)
            .filter(Certificado.org_id == org_id, Certificado.serial == serial)
            .order_by(
                Certificado.valido_ate.desc(),
                Certificado.valido_de.desc(),
                Certificado.id.desc(),
            )
            .all()
        )
        for certificado in certificados[1:]:
            logger.info(
                "Removendo duplicata por serial: serial=%s org_id=%s id=%s",
                serial,
                org_id,
                certificado.id,
            )
            db_session.delete(certificado)
            removed += 1

    duplicate_empresas = (
        db_session.query(Certificado.empresa_id)
        .filter(
            Certificado.org_id == org_id,
            Certificado.empresa_id.isnot(None),
        )
        .group_by(Certificado.empresa_id)
        .having(func.count(Certificado.id) > 1)
        .all()
    )

    for (empresa_id,) in duplicate_empresas:
        certificados = (
            db_session.query(Certificado)
            .filter(
                Certificado.org_id == org_id,
                Certificado.empresa_id == empresa_id,
            )
            .order_by(
                Certificado.valido_ate.desc(),
                Certificado.valido_de.desc(),
                Certificado.id.desc(),
            )
            .all()
        )
        for certificado in certificados[1:]:
            logger.info(
                "Removendo duplicata por empresa: empresa_id=%s org_id=%s id=%s",
                empresa_id,
                org_id,
                certificado.id,
            )
            db_session.delete(certificado)
            removed += 1

    if removed:
        db_session.commit()
        logger.info("%s certificados antigos/duplicados removidos", removed)
    else:
        logger.info("Nenhum certificado duplicado identificado para limpeza")

    return removed


def prune_missing_by_arquivo(org_id: str, keep_arquivos: set[str], db_session: Session) -> int:
    """Remove certificados do org que não existem na pasta de origem."""

    query = db_session.query(Certificado).filter(Certificado.org_id == org_id)
    if keep_arquivos:
        query = query.filter(Certificado.arquivo.notin_(keep_arquivos))
    removidos = query.delete(synchronize_session=False)
    db_session.commit()
    return removidos


def ingest_certificados(certificados_dir: str, org_id: str, db_session: Session) -> int:
    """Percorre o diretório informado e realiza o *upsert* dos certificados."""

    logger.info("Iniciando ingestão de certificados no diretório %s", certificados_dir)
    removed = cleanup_certificados_antigos(org_id, db_session)

    items = list(_iter_certificados(certificados_dir))
    keep_arquivos = {os.path.basename(path) for path, _ in items}

    processed = 0
    failed = 0
    for cert_path, password in items:
        try:
            cert_data = extract_cert_info(cert_path, password)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Falha ao ler certificado %s: %s", cert_path, exc)
            failed += 1
            continue

        cert_info: Dict[str, object] = {
            **cert_data,
            "senha": password,
            "org_id": org_id,
            "path": cert_path,
        }
        upsert_certificado(cert_info, db_session)
        processed += 1

    pruned = prune_missing_by_arquivo(org_id, keep_arquivos, db_session)

    logger.info(
        "Ingestão finalizada. Processados: %s | Falhas: %s | Limpeza prévia: %s | Removidos por sync: %s",
        processed,
        failed,
        removed,
        pruned,
    )
    return processed
