"""Rotinas de ingestão para CNDs (PDF/HTML/Imagem)."""

from __future__ import annotations

import logging
import os
from typing import Dict

from sqlalchemy.orm import Session

from app.models.cnds import Cnd
from app.utils.ocr_utils import ocr_parse_image, parse_html, parse_pdf

logger = logging.getLogger(__name__)


def _upsert_cnd(cnd_info: Dict[str, object], db_session: Session) -> Cnd:
    registro = (
        db_session.query(Cnd)
        .filter(
            Cnd.org_id == cnd_info["org_id"],
            Cnd.orgao == cnd_info["orgao"],
            Cnd.esfera == cnd_info["esfera"],
            Cnd.validade == cnd_info.get("validade"),
        )
        .first()
    )

    if registro:
        logger.info("Atualizando CND existente para órgão %s", registro.orgao)
        registro.status = cnd_info.get("status")
        registro.url = cnd_info.get("url")
        registro.data_emissao = cnd_info.get("data_emissao")
    else:
        logger.info("Inserindo nova CND para órgão %s", cnd_info["orgao"])
        registro = Cnd(**cnd_info)
        db_session.add(registro)

    db_session.commit()
    db_session.refresh(registro)
    return registro


def ingest_cnds(cnds_dir: str, org_id: str, db_session: Session, empresa_id: int | None = None) -> int:
    """Percorre um diretório e realiza *upsert* de CNDs identificadas."""

    processed = 0
    for root, _, files in os.walk(cnds_dir):
        for filename in files:
            file_path = os.path.join(root, filename)
            if filename.lower().endswith(".pdf"):
                cnd_data = parse_pdf(file_path)
            elif filename.lower().endswith(".html"):
                cnd_data = parse_html(file_path)
            elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
                cnd_data = ocr_parse_image(file_path)
            else:
                continue

            if not cnd_data:
                logger.warning("Não foi possível extrair dados de %s", file_path)
                continue

            cnd_info: Dict[str, object] = {
                "org_id": org_id,
                "empresa_id": empresa_id,
                "cnpj": cnd_data.get("cnpj"),
                "orgao": cnd_data.get("orgao") or "",
                "esfera": cnd_data.get("esfera") or "",
                "validade": cnd_data.get("validade"),
                "status": cnd_data.get("status") or "",
                "url": file_path,
                "data_emissao": cnd_data.get("data_emissao"),
            }

            if not cnd_info["orgao"] or not cnd_info["esfera"]:
                logger.warning(
                    "Dados obrigatórios ausentes para %s (orgao/esfera)", file_path
                )
                continue

            _upsert_cnd(cnd_info, db_session)
            processed += 1

    return processed
