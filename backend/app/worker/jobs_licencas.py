from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
from uuid import UUID

from app.db.session import SessionLocal
from app.services.licencas_ingest import (
    DEFAULT_EMPRESAS_ROOT,
    EMPRESAS_ROOT_ENV,
    ingest_licencas_from_fs,
    resolve_empresa_id_por_dir,
)

logger = logging.getLogger(__name__)

LICENCAS_ROOT_ENV = "LICENCAS_ROOT"
ORG_DEFAULT_ENV = "ORG_ID_DEFAULT"


def _resolve_org_id(org_id: str | None) -> str:
    env_org = os.getenv(ORG_DEFAULT_ENV)
    if org_id:
        return org_id
    if env_org:
        return env_org
    raise ValueError("org_id é obrigatório para reprocessar licenças")


def _resolve_root_dir(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit)
    env = os.getenv(LICENCAS_ROOT_ENV) or os.getenv(EMPRESAS_ROOT_ENV)
    return Path(env) if env else DEFAULT_EMPRESAS_ROOT


def _to_uuid(org_id: str) -> UUID:
    return UUID(str(org_id))


def reprocessar_licencas_por_empresa(
    org_id: str | None,
    empresa_id: int | None = None,
    empresa_dir: str | None = None,
    licencas_root: str | None = None,
) -> dict[str, Any]:
    org_id_resolvido = _resolve_org_id(org_id)
    root_dir = _resolve_root_dir(licencas_root)
    empresa_dir_path = Path(empresa_dir) if empresa_dir else None

    if licencas_root:
        os.environ[EMPRESAS_ROOT_ENV] = str(root_dir)

    logger.info(
        "Reprocessando licenças: org_id=%s empresa_id=%s empresa_dir=%s root=%s",
        org_id_resolvido,
        empresa_id,
        empresa_dir_path,
        root_dir,
    )

    with SessionLocal() as db:
        empresa_resolvida = empresa_id
        if empresa_resolvida is None and empresa_dir_path:
            try:
                empresa_resolvida = resolve_empresa_id_por_dir(
                    db, _to_uuid(org_id_resolvido), empresa_dir_path
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Falha ao resolver empresa por diretório: org_id=%s dir=%s",
                    org_id_resolvido,
                    empresa_dir_path,
                )

        resultado = ingest_licencas_from_fs(db, _to_uuid(org_id_resolvido), empresa_resolvida)

    logger.info(
        "Reprocessamento de licenças concluído: org_id=%s empresa_id=%s",
        org_id_resolvido,
        empresa_resolvida,
    )
    return {
        "org_id": org_id_resolvido,
        "empresa_id": empresa_resolvida,
        "resultado": resultado,
        "root_dir": str(root_dir),
    }


def ingest_licencas_full(org_id: str | None, empresa_id: int | None = None) -> dict[str, Any]:
    org_id_resolvido = _resolve_org_id(org_id)
    logger.info("Iniciando ingest full de licenças: org_id=%s empresa_id=%s", org_id_resolvido, empresa_id)
    with SessionLocal() as db:
        resultado = ingest_licencas_from_fs(db, _to_uuid(org_id_resolvido), empresa_id)
    logger.info("Ingest full de licenças concluído: org_id=%s empresa_id=%s", org_id_resolvido, empresa_id)
    return {
        "org_id": org_id_resolvido,
        "empresa_id": empresa_id,
        "resultado": resultado,
    }


__all__ = [
    "reprocessar_licencas_por_empresa",
    "ingest_licencas_full",
]
