from __future__ import annotations

import logging
import os
from pathlib import Path

from app.db.session import SessionLocal
from app.services.certificados_ingest import (
    ingest_certificado_arquivo,
    ingest_certificados,
)

logger = logging.getLogger(__name__)

CERTIFICADOS_ENV = "CERTIFICADOS_ROOT"
LEGACY_CERTIFICADOS_ENV = "ECONTROLE_CERTIFICADOS_DIR"
DEFAULT_CERTIFICADOS_DIR = r"G:\\CERTIFICADOS DIGITAIS"


def _resolve_certificados_dir(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    env = os.getenv(CERTIFICADOS_ENV) or os.getenv(LEGACY_CERTIFICADOS_ENV)
    return env or DEFAULT_CERTIFICADOS_DIR


def processar_certificado_por_arquivo(org_id: str, caminho_arquivo: str) -> dict[str, object]:
    logger.info("Processando certificado: org_id=%s arquivo=%s", org_id, caminho_arquivo)
    caminho_normalizado = str(Path(caminho_arquivo))
    with SessionLocal() as db:
        certificado = ingest_certificado_arquivo(caminho_normalizado, org_id, db)
        logger.info(
            "Certificado processado: org_id=%s arquivo=%s id=%s",
            org_id,
            caminho_normalizado,
            certificado.id,
        )
        return {"certificado_id": certificado.id, "caminho": caminho_normalizado}


def ingest_certificados_full(org_id: str, certificados_dir: str | None = None) -> dict[str, int]:
    dir_path = _resolve_certificados_dir(certificados_dir)
    logger.info("Iniciando ingest full de certificados: org_id=%s dir=%s", org_id, dir_path)
    with SessionLocal() as db:
        processed = ingest_certificados(dir_path, org_id, db)
        logger.info(
            "Ingest full de certificados concluída: org_id=%s dir=%s processed=%s",
            org_id,
            dir_path,
            processed,
        )
        return {"processed": processed, "dir": dir_path}


__all__ = [
    "processar_certificado_por_arquivo",
    "ingest_certificados_full",
]
