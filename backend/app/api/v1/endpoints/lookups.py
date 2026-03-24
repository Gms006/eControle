import asyncio
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
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

# Timeout longo: o usuário precisa de tempo para resolver o captcha da RFB
_RFB_AGENT_TIMEOUT_SECONDS = 360
_RFB_AGENT_STARTUP_SECONDS = 20
_RFB_AGENT_HEALTHCHECK_INTERVAL_SECONDS = 0.5

_RFB_AGENT_PROCESS: subprocess.Popen | None = None
_RFB_AGENT_LOCK = asyncio.Lock()


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


def is_result_useful(mapped: dict[str, Any]) -> bool:
    """
    Retorna True se o resultado da consulta tem dados mínimos úteis.
    Critério: razao_social preenchida. Sem ela o cadastro não pode ser
    complementado de forma significativa e o fallback RFB deve ser oferecido.
    """
    razao = (mapped.get("razao_social") or "").strip()
    return bool(razao)

def _rfb_agent_base_url() -> str:
    return str(settings.RFB_AGENT_URL).rstrip("/")


def _rfb_agent_host_port() -> tuple[str, int]:
    parsed = urlparse(_rfb_agent_base_url())
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 8021
    return host, port


def _rfb_agent_script_path() -> Path:
    backend_root = Path(__file__).resolve().parents[4]
    script_path = backend_root / "scripts" / "rfb_agent.py"
    if not script_path.exists():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Script do agente RFB nao encontrado em: {script_path}",
        )
    return script_path


def _extract_agent_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            detail = payload.get("detail")
            if detail:
                return str(detail)
    except Exception:
        pass

    text = (response.text or "").strip()
    return text or f"HTTP {response.status_code}"


async def _is_rfb_agent_healthy(timeout_seconds: float = 1.5) -> bool:
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(f"{_rfb_agent_base_url()}/health")
            return response.status_code == status.HTTP_200_OK
    except Exception:
        return False


async def ensure_rfb_agent_running() -> None:
    global _RFB_AGENT_PROCESS

    if await _is_rfb_agent_healthy():
        return

    async with _RFB_AGENT_LOCK:
        if await _is_rfb_agent_healthy():
            return

        script_path = _rfb_agent_script_path()
        host, port = _rfb_agent_host_port()

        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        env["RFB_AGENT_HOST"] = host
        env["RFB_AGENT_PORT"] = str(port)

        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

        _RFB_AGENT_PROCESS = subprocess.Popen(
            [sys.executable, str(script_path)],
            cwd=str(script_path.parent.parent),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )

        deadline = time.monotonic() + _RFB_AGENT_STARTUP_SECONDS
        while time.monotonic() < deadline:
            if await _is_rfb_agent_healthy():
                return

            if _RFB_AGENT_PROCESS.poll() is not None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Nao foi possivel iniciar o agente RFB automaticamente.",
                )

            await asyncio.sleep(_RFB_AGENT_HEALTHCHECK_INTERVAL_SECONDS)

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O agente RFB nao respondeu ao healthcheck apos a inicializacao.",
        )

@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
async def fetch_receitaws_payload(cnpj: str) -> dict[str, Any]:
    url = f"https://www.receitaws.com.br/v1/cnpj/{cnpj}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers={"Accept": "application/json"})
        if r.status_code in (429, 500, 502, 503, 504):
            raise httpx.HTTPError(f"ReceitaWS temporary error: HTTP {r.status_code}")
        r.raise_for_status()
        return r.json()


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
async def fetch_brasilapi_payload(cnpj: str) -> dict[str, Any]:
    url = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers={"Accept": "application/json"})
        if r.status_code in (429, 500, 502, 503, 504):
            raise httpx.HTTPError(f"BrasilAPI temporary error: HTTP {r.status_code}")
        if r.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CNPJ nao encontrado")
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


def map_brasilapi_payload(cnpj: str, data: dict[str, Any]) -> dict[str, Any]:
    cnae_principal = []
    cnae_fiscal = normalize_spaces(data.get("cnae_fiscal"))
    cnae_fiscal_desc = normalize_spaces(data.get("cnae_fiscal_descricao"))
    if cnae_fiscal or cnae_fiscal_desc:
        cnae_principal.append({"code": cnae_fiscal or "", "text": cnae_fiscal_desc or ""})

    cnaes_secundarios = []
    for item in data.get("cnaes_secundarios") or []:
        if not isinstance(item, dict):
            continue
        code = normalize_spaces(item.get("codigo") or item.get("code"))
        text = normalize_spaces(item.get("descricao") or item.get("text"))
        if code or text:
            cnaes_secundarios.append({"code": code or "", "text": text or ""})

    telefone = extract_primary_phone_digits(
        " / ".join(
            [
                str(data.get("ddd_telefone_1") or "").strip(),
                str(data.get("ddd_telefone_2") or "").strip(),
            ]
        )
    )

    return {
        "cnpj": cnpj,
        "razao_social": normalize_title_case(data.get("razao_social")),
        "nome_fantasia": normalize_title_case(data.get("nome_fantasia")),
        "porte": normalize_spaces(data.get("porte")),
        "municipio": normalize_municipio(data.get("municipio")),
        "municipio_padrao": normalize_municipio(data.get("municipio")),
        "uf": (normalize_spaces(data.get("uf")) or "").upper() or None,
        "email": normalize_email(data.get("email")),
        "telefone": telefone,
        "simei_optante": False,
        "cnaes_principal": cnae_principal,
        "cnaes_secundarios": cnaes_secundarios,
        "status": "success",
    }

def stop_rfb_agent() -> None:
    global _RFB_AGENT_PROCESS

    process = _RFB_AGENT_PROCESS
    if process is None:
        return

    if process.poll() is None:
        try:
            process.terminate()
            process.wait(timeout=5)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass

    _RFB_AGENT_PROCESS = None

# ---------------------------------------------------------------------------
# Endpoint principal: ReceitaWS com fallback BrasilAPI
# ---------------------------------------------------------------------------


@router.get("/receitaws/{cnpj}")
async def lookup_receitaws(
    cnpj: str,
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> dict[str, Any]:
    digits = normalize_cnpj(cnpj)

    now = time.time()
    cached = _CACHE.get(digits)
    if cached and cached[0] > now:
        # Sempre recalcula is_useful no cache (campo leve, sem custo)
        result = dict(cached[1])
        result["is_useful"] = is_result_useful(result)
        return result

    receitaws_error: Exception | None = None
    try:
        data = await fetch_receitaws_payload(digits)
        if isinstance(data, dict) and str(data.get("status", "")).upper() == "ERROR":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=data.get("message") or "CNPJ nao encontrado",
            )
        mapped = map_receitaws_payload(digits, data)
        _CACHE[digits] = (now + _TTL_SECONDS, mapped)
        mapped["is_useful"] = is_result_useful(mapped)
        return mapped
    except HTTPException:
        raise
    except Exception as exc:
        receitaws_error = exc

    try:
        data = await fetch_brasilapi_payload(digits)
        mapped = map_brasilapi_payload(digits, data)
        _CACHE[digits] = (now + _TTL_SECONDS, mapped)
        mapped["is_useful"] = is_result_useful(mapped)
        return mapped
    except HTTPException:
        raise
    except Exception as brasilapi_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lookup indisponivel (ReceitaWS: {receitaws_error}; BrasilAPI: {brasilapi_error})",
        )


# ---------------------------------------------------------------------------
# Endpoint de fallback: Agente RFB local
# ---------------------------------------------------------------------------


@router.get("/rfb/{cnpj}")
async def lookup_rfb(
    cnpj: str,
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> dict[str, Any]:
    """
    Fallback para consulta direta à Receita Federal via automação local.

    O agente abre o Chromium, o usuário resolve o captcha e clica em
    "Consultar". O resultado é lido automaticamente e devolvido ao portal.

    Timeout: 6 minutos (tempo para resolver o captcha).
    """
    digits = normalize_cnpj(cnpj)
    await ensure_rfb_agent_running()
    agent_url = f"{_rfb_agent_base_url()}/scrape/{digits}"

    try:
        async with httpx.AsyncClient(timeout=_RFB_AGENT_TIMEOUT_SECONDS) as client:
            r = await client.get(agent_url)

            if r.status_code == status.HTTP_409_CONFLICT:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "O agente RFB já está processando outra consulta. "
                        "Aguarde a conclusão e tente novamente."
                    ),
                )

            if r.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
                detail = _extract_agent_error_detail(r)
                raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=detail)

            if r.status_code >= 400:
                detail = _extract_agent_error_detail(r)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Agente RFB retornou erro: {detail}",
                )

            mapped: dict[str, Any] = r.json()

    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Nao foi possivel conectar ao agente RFB apos a inicializacao automatica.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout: o captcha não foi resolvido dentro do prazo.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro inesperado no agente RFB: {exc}",
        )

    # Salva no cache e adiciona flag de utilidade
    now = time.time()
    _CACHE[digits] = (now + _TTL_SECONDS, {k: v for k, v in mapped.items() if k != "is_useful"})
    mapped["is_useful"] = is_result_useful(mapped)
    return mapped