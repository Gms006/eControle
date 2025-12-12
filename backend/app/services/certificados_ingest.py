"""Rotinas de ingestão e persistência de certificados digitais."""

from __future__ import annotations

import logging
import os
from typing import Dict, Iterable

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization.pkcs12 import (
    load_key_and_certificates,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.certificados import Certificado

logger = logging.getLogger(__name__)


def extract_cert_info(cert_path: str, password: str) -> Dict[str, object]:
    """Extrai informações principais de um arquivo ``.pfx``."""

    with open(cert_path, "rb") as cert_file:
        cert_data = cert_file.read()

    _, certificate, _ = load_key_and_certificates(cert_data, password.encode("utf-8"))
    if certificate is None:
        raise ValueError(f"Certificado ausente no arquivo: {cert_path}")

    subject = certificate.subject.rfc4514_string()
    issuer = certificate.issuer.rfc4514_string()
    valid_from = certificate.not_valid_before.date()
    valid_until = certificate.not_valid_after.date()
    thumbprint = certificate.fingerprint(hashes.SHA1()).hex()
    serial = hex(certificate.serial_number)[2:].upper()

    return {
        "subject": subject,
        "issuer": issuer,
        "valid_from": valid_from,
        "valid_until": valid_until,
        "thumbprint": thumbprint,
        "serial": serial,
    }


def upsert_certificado(cert_info: Dict[str, object], db_session: Session) -> Certificado:
    """Atualiza ou insere um certificado com base no serial e ``org_id``."""

    certificado = (
        db_session.query(Certificado)
        .filter(
            Certificado.serial == cert_info["serial"],
            Certificado.org_id == cert_info["org_id"],
        )
        .first()
    )

    if certificado:
        logger.info(
            "Atualizando certificado existente: serial=%s org_id=%s",
            cert_info["serial"],
            cert_info["org_id"],
        )
        certificado.subject = cert_info["subject"]
        certificado.issuer = cert_info["issuer"]
        certificado.valido_de = cert_info["valid_from"]
        certificado.valido_ate = cert_info["valid_until"]
        certificado.sha1 = cert_info["thumbprint"]
        certificado.senha = cert_info.get("senha")
    else:
        logger.info(
            "Inserindo novo certificado: serial=%s org_id=%s",
            cert_info["serial"],
            cert_info["org_id"],
        )
        certificado = Certificado(
            org_id=cert_info["org_id"],
            empresa_id=cert_info.get("empresa_id"),
            arquivo=os.path.basename(cert_info["path"]),
            caminho=cert_info["path"],
            serial=cert_info["serial"],
            sha1=cert_info["thumbprint"],
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


def _iter_certificados(certificados_dir: str) -> Iterable[tuple[str, str]]:
    for root, _, files in os.walk(certificados_dir):
        for filename in files:
            if not filename.lower().endswith(".pfx"):
                continue
            password = ""
            if "senha" in filename.lower():
                try:
                    password = filename.split("Senha", 1)[1].split(".pfx")[0].strip()
                except IndexError:
                    password = ""
            yield os.path.join(root, filename), password


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


def ingest_certificados(certificados_dir: str, org_id: str, db_session: Session) -> int:
    """Percorre o diretório informado e realiza o *upsert* dos certificados."""

    logger.info("Iniciando ingestão de certificados no diretório %s", certificados_dir)
    removed = cleanup_certificados_antigos(org_id, db_session)

    processed = 0
    failed = 0
    for cert_path, password in _iter_certificados(certificados_dir):
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

    logger.info(
        "Ingestão finalizada. Processados: %s | Falhas: %s | Limpeza prévia: %s",
        processed,
        failed,
        removed,
    )
    return processed
