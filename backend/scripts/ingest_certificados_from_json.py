"""LEGADO: Script de ingestão de certificados a partir de JSON.

Mantido apenas para debug/migrações pontuais. O pipeline oficial
deve usar app.services.certificados_ingest + certificates_orchestrate.py.
"""
# ⚠️ NÃO USE ESTE SCRIPT NO FLUXO PRINCIPAL (S4).
# Use backend/scripts/certificates_orchestrate.py em vez disso.

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    logger.warning(
        "Este script é legado e não deve ser usado no fluxo principal. "
        "Execute certificates_orchestrate.py para a ingestão oficial."
    )

    json_path = Path(os.getenv("CERTIFICADOS_JSON", r"G:\\CERTIFICADOS DIGITAIS\certificados.json"))
    if not json_path.exists():
        logger.error("Arquivo JSON não encontrado: %s", json_path)
        return 1

    try:
        raw = json_path.read_text(encoding="utf-8")
        data: Any = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao ler certificados do JSON legado: %s", exc)
        return 1

    logger.info(
        "JSON carregado apenas para inspeção (sem persistir). Registros encontrados: %s",
        len(data) if isinstance(data, list) else "desconhecido",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
