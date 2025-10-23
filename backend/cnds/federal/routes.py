"""Rotas para emissão de CND Federal (Receita Federal do Brasil)."""
from __future__ import annotations

import logging
import re
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .cnds_worker_rfb import emitir_cnd_federal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cnds/federal", tags=["cnds"])


class EmitirCNDRequest(BaseModel):
    """Requisição para emissão da CND Federal."""

    cnpj: str = Field(..., description="CNPJ da empresa")


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


@router.post("/emitir")
async def emitir_cnd_federal_api(req: EmitirCNDRequest) -> Dict[str, Any]:
    """Endpoint para emitir a CND Federal e retornar o resultado padronizado."""

    cnpj_digits = _only_digits(req.cnpj)
    if len(cnpj_digits) != 14:
        raise HTTPException(400, "CNPJ inválido (14 dígitos).")

    logger.info("[CND Federal] Solicitação recebida para o CNPJ %s", cnpj_digits)

    try:
        result = await emitir_cnd_federal(cnpj_digits)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[CND Federal] Erro inesperado durante a emissão: %s", exc)
        return {
            "ok": False,
            "info": "Erro inesperado ao emitir a CND Federal.",
            "path": None,
            "url": None,
        }

    if not isinstance(result, dict):
        logger.warning(
            "[CND Federal] Retorno inesperado do worker: %r", result
        )
        return {
            "ok": False,
            "info": "Resposta inválida ao emitir a CND Federal.",
            "path": None,
            "url": None,
        }

    return result
