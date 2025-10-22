"""Rotas FastAPI para emissão da CAE/FIC."""
from __future__ import annotations

import re
import unicodedata
from typing import Dict

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .cae_worker_anapolis import emitir_cae_anapolis, normalize_im, only_digits

router = APIRouter(prefix="/api/cae", tags=["cae"])


class EmitirCAEBody(BaseModel):
    municipio: str = Field(..., description="Município da empresa")
    cnpj: str
    im: str


def _normalize_municipio(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _response(content: Dict, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=content)


@router.post("/emitir")
async def emitir_cae(body: EmitirCAEBody):
    municipio_norm = _normalize_municipio(body.municipio)
    if municipio_norm != "anapolis":
        return _response(
            {
                "ok": False,
                "info": "Emissão disponível apenas para Anápolis.",
                "path": None,
                "url": None,
            },
            status_code=400,
        )

    cnpj_digits = only_digits(body.cnpj)
    if len(cnpj_digits) != 14:
        return _response(
            {
                "ok": False,
                "info": "CNPJ inválido (14 dígitos).",
                "path": None,
                "url": None,
            },
            status_code=400,
        )

    im_normalizada = normalize_im(body.im)
    if not im_normalizada:
        return _response(
            {
                "ok": False,
                "info": "Inscrição Municipal inválida.",
                "path": None,
                "url": None,
            },
            status_code=400,
        )

    resultado = await emitir_cae_anapolis(cnpj_digits, im_normalizada)
    status = 200 if resultado.get("ok") else 500
    return _response(resultado, status_code=status)

