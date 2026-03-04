import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.normalization import (
    extract_primary_phone_digits,
    normalize_email,
    normalize_municipio,
    normalize_spaces,
    normalize_title_case,
)
from app.core.security import require_roles


router = APIRouter()

# cache simples em memória (suficiente para DEV/local)
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 24 * 60 * 60


def normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 14:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CNPJ invalido")
    return digits


def map_cnae_item(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    code = normalize_spaces(item.get("code"))
    text = normalize_spaces(item.get("text"))
    if not code and not text:
        return None
    return {"code": code or "", "text": text or ""}


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
async def fetch_receitaws_payload(cnpj: str) -> dict[str, Any]:
    url = f"https://www.receitaws.com.br/v1/cnpj/{cnpj}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers={"Accept": "application/json"})
        if r.status_code in (429, 500, 502, 503, 504):
            # força retry
            raise httpx.HTTPError(f"ReceitaWS temporary error: HTTP {r.status_code}")
        r.raise_for_status()
        return r.json()


def map_receitaws_payload(cnpj: str, data: dict[str, Any]) -> dict[str, Any]:
    principal = data.get("atividade_principal") or []
    secundarios = data.get("atividades_secundarias") or []
    cnaes_principal = [entry for entry in (map_cnae_item(item) for item in principal) if entry]
    cnaes_secundarios = [entry for entry in (map_cnae_item(item) for item in secundarios) if entry]
    raw_simei = data.get("simei")
    simei_optante = bool(isinstance(raw_simei, dict) and raw_simei.get("optante") is True)

    return {
        "cnpj": cnpj,
        "razao_social": normalize_title_case(data.get("nome")),
        "nome_fantasia": normalize_title_case(data.get("fantasia")),
        "porte": normalize_spaces(data.get("porte")),
        "municipio": normalize_municipio(data.get("municipio")),
        "municipio_padrao": normalize_municipio(data.get("municipio")),
        "uf": (normalize_spaces(data.get("uf")) or "").upper() or None,
        "email": normalize_email(data.get("email")),
        "telefone": extract_primary_phone_digits(data.get("telefone")),
        "simei_optante": simei_optante,
        "cnaes_principal": cnaes_principal,
        "cnaes_secundarios": cnaes_secundarios,
        "status": "success",
    }


@router.get("/receitaws/{cnpj}")
async def lookup_receitaws(
    cnpj: str,
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> dict[str, Any]:
    digits = normalize_cnpj(cnpj)

    now = time.time()
    cached = _CACHE.get(digits)
    if cached and cached[0] > now:
        return cached[1]

    try:
        data = await fetch_receitaws_payload(digits)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ReceitaWS indisponivel: {exc}",
        )

    # ReceitaWS costuma retornar {"status":"ERROR","message":"..."} em alguns casos
    if isinstance(data, dict) and str(data.get("status", "")).upper() == "ERROR":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=data.get("message") or "CNPJ nao encontrado")

    mapped = map_receitaws_payload(digits, data)

    _CACHE[digits] = (now + _TTL_SECONDS, mapped)
    return mapped
