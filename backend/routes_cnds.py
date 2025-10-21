import json
import os
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cnds_worker_anapolis import emitir_cnd_anapolis
from cnds_worker_centi import emitir_cnd_centi
from cnds_worker_megasoft import emitir_cnd_megasoft
from cnds_worker_sig import emitir_cnd_sig

router = APIRouter(tags=["cnds"])


class EmitirPedido(BaseModel):
    municipio: str = Field(..., description="Município da empresa")
    cnpj: str


def only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


def _is_anapolis(value: str) -> bool:
    normalized = _normalize_text(value)
    if not normalized:
        return False
    parts = normalized.replace("/", " ").split()
    return any(part == "anapolis" for part in parts)


def _ensure_https(url: str) -> str:
    if not url:
        return url
    url = url.strip()
    if url.startswith("http://"):
        url = "https://" + url[len("http://") :]
    if not url.startswith("https://"):
        url = f"https://{url.lstrip('/')}"
    return url


MEGASOFT_MAP_PATH = Path(__file__).parent / "megasoft_map.json"
SIG_MAP_PATH = Path(__file__).parent / "sig_map.json"
CENTI_MAP_PATH = Path(__file__).parent / "centi_map.json"
CND_DIR_BASE = Path(os.getenv("CND_DIR_BASE", "certidoes"))
CND_HEADLESS = (os.getenv("CND_HEADLESS", "true").strip().lower() in {"1", "true", "yes", "on"})
CND_CHROME_PATH = os.getenv("CND_CHROME_PATH") or None

CND_DIR_BASE.mkdir(parents=True, exist_ok=True)


@lru_cache()
def _load_megasoft_map() -> Dict[str, Dict[str, str]]:
    if not MEGASOFT_MAP_PATH.exists():
        return {}
    try:
        entries = json.loads(MEGASOFT_MAP_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

    mapping: Dict[str, Dict[str, str]] = {}
    for item in entries:
        municipio = item.get("municipio", "")
        base_url = _ensure_https(item.get("base_url", ""))
        if not municipio or not base_url:
            continue
        normalized = _normalize_text(municipio)
        if not normalized:
            continue
        mapping[normalized] = {
            "municipio": municipio,
            "base_url": base_url,
            "slug": item.get("slug") or "",
        }
    return mapping


@lru_cache()
def _load_sig_map() -> Dict[str, Dict[str, str]]:
    if not SIG_MAP_PATH.exists():
        return {}
    try:
        entries = json.loads(SIG_MAP_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

    mapping: Dict[str, Dict[str, str]] = {}
    for item in entries:
        municipio = item.get("municipio", "")
        base_url = (item.get("base_url") or "").strip()
        slug = (item.get("slug") or "").strip()
        if not municipio or not base_url:
            continue
        normalized = _normalize_text(municipio)
        if not normalized:
            continue
        mapping[normalized] = {
            "municipio": municipio,
            "base_url": base_url,
            "slug": slug,
        }
    return mapping


@lru_cache()
def _load_centi_map() -> Dict[str, Dict[str, str]]:
    if not CENTI_MAP_PATH.exists():
        return {}
    try:
        entries = json.loads(CENTI_MAP_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

    mapping: Dict[str, Dict[str, str]] = {}
    for item in entries:
        municipio = item.get("municipio", "")
        base_url = _ensure_https(item.get("base_url", ""))
        slug = (item.get("slug") or "").strip()
        if not municipio or not base_url:
            continue
        normalized = _normalize_text(municipio)
        if not normalized:
            continue
        mapping[normalized] = {
            "municipio": municipio,
            "base_url": base_url,
            "slug": slug,
        }
    return mapping


@router.post("/cnds/emitir")
async def cnds_emitir(ped: EmitirPedido):
    municipio_raw = ped.municipio or ""
    municipio_norm = _normalize_text(municipio_raw)
    if not municipio_norm:
        raise HTTPException(400, "Município é obrigatório.")

    cnpj = only_digits(ped.cnpj)
    if len(cnpj) != 14:
        raise HTTPException(400, "CNPJ inválido (14 dígitos).")

    if _is_anapolis(municipio_raw):
        ok, info, path, url = await emitir_cnd_anapolis(cnpj)
        return {"ok": ok, "info": info, "path": path, "url": url}

    megasoft_map = _load_megasoft_map()
    info: Optional[Dict[str, str]] = megasoft_map.get(municipio_norm)
    if not info:
        for key, data in megasoft_map.items():
            if key in municipio_norm or municipio_norm in key:
                info = data
                break
    if info:
        result = await emitir_cnd_megasoft(
            cnpj=cnpj,
            base_url=info["base_url"],
            cidade=info["municipio"],
            download_dir=CND_DIR_BASE,
            headless=CND_HEADLESS,
        )
        return {
            "ok": result.get("ok", False),
            "info": result.get("info"),
            "path": result.get("path"),
            "url": result.get("url"),
        }

    centi_map = _load_centi_map()
    centi_info: Optional[Dict[str, str]] = centi_map.get(municipio_norm)
    if not centi_info:
        for key, data in centi_map.items():
            if key in municipio_norm or municipio_norm in key:
                centi_info = data
                break

    if centi_info:
        result = await emitir_cnd_centi(
            cnpj=cnpj,
            base_url=centi_info["base_url"],
            municipio=centi_info["municipio"],
            download_dir=CND_DIR_BASE,
            headless=CND_HEADLESS,
            chrome_path=CND_CHROME_PATH,
            timeout_ms=30000,
        )
        message = result.get("message") or (
            "Certidão emitida com sucesso." if result.get("ok") else "Não foi possível emitir a CND."
        )
        return {
            "ok": result.get("ok", False),
            "info": message,
            "path": result.get("file_path"),
            "url": result.get("public_url"),
        }

    sig_map = _load_sig_map()
    sig_info: Optional[Dict[str, str]] = sig_map.get(municipio_norm)
    if not sig_info:
        for key, data in sig_map.items():
            if key in municipio_norm or municipio_norm in key:
                sig_info = data
                break

    if sig_info:
        result = await emitir_cnd_sig(
            cnpj=cnpj,
            base_url=sig_info["base_url"],
            cidade=sig_info["municipio"],
            download_dir=CND_DIR_BASE,
            headless=CND_HEADLESS,
            chrome_path=CND_CHROME_PATH,
        )
        return {
            "ok": result.get("ok", False),
            "info": result.get("info"),
            "path": result.get("path"),
            "url": result.get("url"),
        }

    return {
        "ok": False,
        "info": "Município não suportado para emissão automática de CND.",
        "path": None,
        "url": None,
    }


@router.get("/cnds/{cnpj}/list")
async def cnds_list(cnpj: str):
    digits = only_digits(cnpj)
    if not digits:
        return []

    base = CND_DIR_BASE / digits
    if not base.exists():
        return []

    arquivos = sorted(
        base.glob("*.pdf"),
        key=lambda arquivo: arquivo.stat().st_mtime,
        reverse=True,
    )

    itens = []
    for arquivo in arquivos:
        stat = arquivo.stat()
        itens.append(
            {
                "name": arquivo.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "url": f"/cnds/{digits}/{arquivo.name}",
            }
        )

    return itens

