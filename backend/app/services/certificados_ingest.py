"""Rotinas de ingestão e persistência de certificados digitais."""

from __future__ import annotations

import logging
import os
from typing import Dict, Iterable

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization.pkcs12 import (
    load_key_and_certificates,
)
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


def ingest_certificados(certificados_dir: str, org_id: str, db_session: Session) -> int:
    """Percorre o diretório informado e realiza o *upsert* dos certificados."""

    processed = 0
    for cert_path, password in _iter_certificados(certificados_dir):
        try:
            cert_data = extract_cert_info(cert_path, password)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Falha ao ler certificado %s: %s", cert_path, exc)
            continue

        cert_info: Dict[str, object] = {
            **cert_data,
            "senha": password,
            "org_id": org_id,
            "path": cert_path,
        }
        upsert_certificado(cert_info, db_session)
        processed += 1

    return processed
