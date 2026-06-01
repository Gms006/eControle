import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel


router = APIRouter(prefix="/api", tags=["legacy-certidoes"])

_ALLOWED_EXTENSIONS = {".pdf", ".html", ".htm", ".png", ".jpg", ".jpeg"}
_DEFAULT_TIMEOUT_SECONDS = 420


class CertidaoEmitRequest(BaseModel):
    cnpj: str
    municipio: str | None = None
    uf: str | None = None
    force: bool = False


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 14:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CNPJ inválido")
    return digits


def _certidoes_root() -> Path:
    configured = (
        os.getenv("ECONTROLE_CERTIDOES_DIR")
        or os.getenv("CND_ROOT_DIR")
        or os.getenv("CERTIDOES_ROOT_DIR")
        or ""
    ).strip()
    if configured:
        return Path(configured).expanduser()
    return _backend_root() / "cnds"


def _company_dir(cnpj: str) -> Path:
    return _certidoes_root() / cnpj


def _safe_file_name(name: str) -> str:
    filename = Path(name or "").name
    if not filename or filename in {".", ".."}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo inválido")
    return filename


def _detect_kind(path: Path) -> str:
    text = path.name.lower()
    if "cae" in text or "cadastro" in text:
        return "CAE"
    if "federal" in text or "rfb" in text or "receita" in text:
        return "CND Federal"
    if "municip" in text or "prefeitura" in text:
        return "CND Municipal"
    if "estad" in text or "sefaz" in text:
        return "CND Estadual"
    return "Certidão"


def _iter_document_files(cnpj: str):
    folder = _company_dir(cnpj)
    if not folder.exists() or not folder.is_dir():
        return []
    files = []
    for path in folder.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in _ALLOWED_EXTENSIONS:
            continue
        files.append(path)
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


def _document_payload(cnpj: str, path: Path) -> dict[str, Any]:
    stat = path.stat()
    modified_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    filename = path.name
    return {
        "name": filename,
        "filename": filename,
        "tipo": _detect_kind(path),
        "cnpj": cnpj,
        "size_bytes": stat.st_size,
        "modified_at": modified_at,
        "url": f"/api/cnds/{cnpj}/download?name={filename}",
        "download_url": f"/api/cnds/{cnpj}/download?name={filename}",
        "open_url": f"/api/cnds/{cnpj}/download?name={filename}",
    }


def _list_documents(cnpj: str) -> list[dict[str, Any]]:
    return [_document_payload(cnpj, path) for path in _iter_document_files(cnpj)]


def _run_optional_script(kind: str, payload: CertidaoEmitRequest) -> None:
    env_key = "CAE_EMIT_SCRIPT" if kind == "cae" else "CND_EMIT_SCRIPT"
    script = (os.getenv(env_key) or "").strip()
    if not script:
        return

    script_path = Path(script).expanduser()
    if not script_path.exists():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Script configurado em {env_key}, mas não encontrado: {script_path}",
        )

    command = [str(script_path), payload.cnpj]
    if payload.municipio:
        command.append(payload.municipio)
    if payload.uf:
        command.append(payload.uf)
    if payload.force:
        command.append("--force")

    try:
        completed = subprocess.run(
            command,
            cwd=str(script_path.parent),
            capture_output=True,
            text=True,
            timeout=int(os.getenv("CERTIDOES_SCRIPT_TIMEOUT_SECONDS", str(_DEFAULT_TIMEOUT_SECONDS))),
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout ao executar automação de certidão.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao executar automação de certidão: {exc}",
        )

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail or f"Automação de certidão retornou código {completed.returncode}.",
        )


@router.get("/cnds/{cnpj}/list")
def list_cnds(cnpj: str) -> list[dict[str, Any]]:
    digits = _normalize_cnpj(cnpj)
    return _list_documents(digits)


@router.get("/cnds/{cnpj}/download")
def download_cnd(cnpj: str, name: str = Query(...)):
    digits = _normalize_cnpj(cnpj)
    filename = _safe_file_name(name)
    path = _company_dir(digits) / filename
    if not path.exists() or not path.is_file() or path.suffix.lower() not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certidão não encontrada")
    return FileResponse(str(path), filename=filename)


@router.post("/cnds/emitir")
def emitir_cnd(payload: CertidaoEmitRequest) -> dict[str, Any]:
    payload.cnpj = _normalize_cnpj(payload.cnpj)
    before = _list_documents(payload.cnpj)
    _run_optional_script("cnd", payload)
    after = _list_documents(payload.cnpj)
    if after:
        return {"status": "ok", "items": after, "latest": after[0]}
    if before:
        return {"status": "ok", "items": before, "latest": before[0], "warning": "Nenhum arquivo novo foi encontrado."}
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Nenhuma CND encontrada. Configure CND_EMIT_SCRIPT para emissão automática "
            "ou salve os arquivos em ECONTROLE_CERTIDOES_DIR/<CNPJ>."
        ),
    )


@router.post("/cae/emitir")
def emitir_cae(payload: CertidaoEmitRequest) -> dict[str, Any]:
    payload.cnpj = _normalize_cnpj(payload.cnpj)
    before = _list_documents(payload.cnpj)
    _run_optional_script("cae", payload)
    after = _list_documents(payload.cnpj)
    cae_items = [item for item in after if item.get("tipo") == "CAE"]
    if cae_items:
        return {"status": "ok", "items": after, "latest": cae_items[0]}
    if after:
        return {"status": "ok", "items": after, "latest": after[0], "warning": "Nenhum CAE explícito foi identificado; abrindo documento mais recente."}
    if before:
        return {"status": "ok", "items": before, "latest": before[0], "warning": "Nenhum arquivo novo foi encontrado."}
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Nenhum CAE encontrado. Configure CAE_EMIT_SCRIPT para emissão automática "
            "ou salve os arquivos em ECONTROLE_CERTIDOES_DIR/<CNPJ>."
        ),
    )
