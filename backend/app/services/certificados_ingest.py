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
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.certificados import Certificado

logger = logging.getLogger(__name__)


def extract_cert_info(cert_path: str, password: str) -> Dict[str, object]:
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
    """
    Atualiza ou insere um certificado.

    Regra:
      1) tenta por (org_id, serial)
      2) se não achar por serial e houver empresa_id, substitui o certificado "ativo" da empresa
         (mantém 1 registro por empresa, como o ingest legado via JSON)
      3) senão, insere novo
    """

    org_id = cert_info["org_id"]
    serial = cert_info["serial"]
    empresa_id = cert_info.get("empresa_id")

    certificado = (
        db_session.query(Certificado)
        .filter(
            Certificado.serial == serial,
            Certificado.org_id == org_id,
        )
        .first()
    )

    # Se não achou pelo serial e temos empresa_id, tenta substituir o certificado existente da empresa
    if not certificado and empresa_id:
        certificado = (
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
            .first()
        )
        if certificado:
            logger.info(
                "Substituindo certificado por empresa (serial novo): empresa_id=%s org_id=%s serial=%s",
                empresa_id,
                org_id,
                serial,
            )

    if certificado:
        logger.info(
            "Atualizando certificado existente: serial=%s org_id=%s",
            serial,
            org_id,
        )
        # Atualiza TUDO (inclusive empresa_id/arquivo/caminho), para ficar idêntico ao comportamento do JSON ingest
        certificado.org_id = org_id
        certificado.empresa_id = empresa_id
        certificado.arquivo = os.path.basename(cert_info["path"])
        certificado.caminho = cert_info["path"]
        certificado.serial = serial
        certificado.subject = cert_info["subject"]
        certificado.issuer = cert_info["issuer"]
        certificado.valido_de = cert_info["valid_from"]
        certificado.valido_ate = cert_info["valid_until"]
        certificado.sha1 = cert_info["thumbprint"]
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
            sha1=cert_info["thumbprint"],
            subject=cert_info["subject"],
            issuer=cert_info["issuer"],
            valido_de=cert_info["valid_from"],
            valido_ate=cert_info["valid_until"],
            senha=cert_info.get("senha"),
        )
        db_session.add(certificado)

    # Garante que ficou apenas 1 por empresa_id (remove duplicados antigos)
    db_session.flush()  # garante id
    if empresa_id and certificado.id:
        duplicados = (
            db_session.query(Certificado)
            .filter(
                Certificado.org_id == org_id,
                Certificado.empresa_id == empresa_id,
                Certificado.id != certificado.id,
            )
            .all()
        )
        for dup in duplicados:
            logger.info(
                "Removendo duplicata por empresa após upsert: empresa_id=%s org_id=%s id=%s",
                empresa_id,
                org_id,
                dup.id,
            )
            db_session.delete(dup)

    db_session.commit()
    db_session.refresh(certificado)
    return certificado


def _iter_certificados(
    certificados_dir: str, recursive: bool = True
) -> Iterable[tuple[str, str]]:
    """
    Percorre o diretório (recursivamente por padrão) retornando caminhos de ``.pfx``
    e senhas extraídas do nome do arquivo.
    """
    if recursive:
        for root, _, files in os.walk(certificados_dir):
            for filename in files:
                if not filename.lower().endswith(".pfx"):
                    continue
                password = _extract_password_from_filename(filename)
                yield os.path.join(root, filename), password
        return

    # Não-recursivo (somente raiz)
    try:
        with os.scandir(certificados_dir) as it:
            for entry in it:
                if not entry.is_file():
                    continue
                filename = entry.name
                if not filename.lower().endswith(".pfx"):
                    continue
                password = _extract_password_from_filename(filename)
                yield entry.path, password
    except FileNotFoundError:
        logger.warning("Diretório de certificados não encontrado: %s", certificados_dir)


def _extract_password_from_filename(filename: str) -> str:
    # aceita "Senha xxxxxx.pfx" e "senha xxxxxx.pfx"
    m = re.search(r"senha\s*(.+?)\.pfx$", filename, flags=re.IGNORECASE)
    return m.group(1).strip() if m else ""


def cleanup_certificados_antigos(org_id: str, db_session: Session) -> int:
    """Remove certificados antigos/duplicados seguindo a regra do script legado."""

    # Apenas para log de referência (evita NameError visto em execuções legadas)
    duplicados_previos = (
        db_session.query(func.count())
        .filter(Certificado.org_id == org_id, Certificado.empresa_id.isnot(None))
        .group_by(Certificado.empresa_id)
        .having(func.count(Certificado.id) > 1)
    ).count()
    if duplicados_previos:
        logger.info(
            "Identificados %s grupos de certificados duplicados antes da limpeza",
            duplicados_previos,
        )

    remove_por_serial = text(
        """
        WITH ranked AS (
          SELECT
            id,
            org_id,
            serial,
            ROW_NUMBER() OVER (
              PARTITION BY org_id, serial
              ORDER BY valido_ate DESC NULLS LAST, valido_de DESC NULLS LAST, id DESC
            ) AS rn
          FROM certificados
          WHERE serial IS NOT NULL AND org_id = :org_id
        )
        DELETE FROM certificados c
        USING ranked r
        WHERE c.id = r.id
          AND r.rn > 1;
        """
    )

    remove_por_empresa = text(
        """
        WITH ranked AS (
          SELECT
            id,
            org_id,
            empresa_id,
            ROW_NUMBER() OVER (
              PARTITION BY org_id, empresa_id
              ORDER BY valido_ate DESC NULLS LAST, valido_de DESC NULLS LAST, id DESC
            ) AS rn
          FROM certificados
          WHERE empresa_id IS NOT NULL AND org_id = :org_id
        )
        DELETE FROM certificados c
        USING ranked r
        WHERE c.id = r.id
          AND r.rn > 1;
        """
    )

    removidos_serial = db_session.execute(remove_por_serial, {"org_id": org_id}).rowcount
    removidos_empresa = db_session.execute(remove_por_empresa, {"org_id": org_id}).rowcount

    removed = (removidos_serial or 0) + (removidos_empresa or 0)
    if removed:
        db_session.commit()
        logger.info("%s certificados antigos/duplicados removidos", removed)
    else:
        logger.info("Nenhum certificado duplicado identificado para limpeza")

    return removed


def _extract_password_from_filename(filename: str) -> str:
    # aceita "Senha xxxxxx.pfx" e "senha xxxxxx.pfx"
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


def ingest_certificados(
    certificados_dir: str, org_id: str, db_session: Session, recursive: bool = False
) -> int:
    """Percorre o diretório informado e realiza o *upsert* dos certificados."""

    logger.info("Iniciando ingestão de certificados no diretório %s", certificados_dir)
    removed = cleanup_certificados_antigos(org_id, db_session)

    processed = 0
    failed = 0
    for cert_path, password in _iter_certificados(certificados_dir, recursive=True):
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
