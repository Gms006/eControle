"""Ferramentas utilitárias para navegação segura em diretórios de requerimentos."""

from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Iterable, Iterator, Tuple

DEFAULT_ALLOWED_EXTS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".png",
    ".jpg",
    ".jpeg",
}


def _normalize_ext(ext: str) -> str:
    value = ext.strip().lower()
    if not value:
        return ""
    if not value.startswith("."):
        value = f".{value}"
    return value


def _prepare_allowed_exts(allowed_exts: Iterable[str] | None) -> set[str]:
    if allowed_exts is None:
        return set(DEFAULT_ALLOWED_EXTS)
    normalized = {_normalize_ext(ext) for ext in allowed_exts}
    filtered = {ext for ext in normalized if ext}
    return filtered or set(DEFAULT_ALLOWED_EXTS)


def _is_allowed(path: Path, root: Path, allowed_exts: set[str]) -> bool:
    try:
        resolved = path.resolve(strict=False)
    except FileNotFoundError:
        return False
    if not resolved.is_file():
        return False
    if resolved.suffix.lower() not in allowed_exts:
        return False
    try:
        resolved.relative_to(root)
    except ValueError:
        return False
    return True


def _b64u(value: str) -> str:
    encoded = base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def _b64u_dec(value: str) -> str:
    padding = "=" * (-len(value) % 4)
    decoded = base64.urlsafe_b64decode((value + padding).encode("ascii"))
    return decoded.decode("utf-8")


def iter_files(
    root: Path,
    allowed_exts: Iterable[str] | None = None,
    max_depth: int | None = None,
) -> Iterator[Path]:
    """Percorre arquivos permitidos a partir de uma raiz, respeitando profundidade."""

    resolved_root = root.resolve()
    allowed = _prepare_allowed_exts(allowed_exts)
    base_parts = len(resolved_root.parts)

    for dirpath, dirnames, filenames in os.walk(resolved_root):
        current_dir = Path(dirpath)
        depth = len(current_dir.parts) - base_parts
        if max_depth is not None and depth >= max_depth:
            dirnames[:] = []
        for filename in filenames:
            candidate = current_dir / filename
            if _is_allowed(candidate, resolved_root, allowed):
                yield candidate


def relid_for(root: Path, file_path: Path) -> Tuple[str, str]:
    relative = file_path.resolve().relative_to(root.resolve()).as_posix()
    file_id = _b64u(relative)
    return file_id, relative


def decode_id_to_path(root: Path, file_id: str) -> Path:
    relative = _b64u_dec(file_id)
    candidate = (root / Path(relative)).resolve()
    resolved_root = root.resolve()
    try:
        candidate.relative_to(resolved_root)
    except ValueError as exc:  # noqa: BLE001
        raise PermissionError("Invalid path traversal") from exc
    return candidate


def infer_tipo_municipio(relpath: str) -> Tuple[str | None, str | None]:
    parts = relpath.split("/")
    tipo = parts[0] if len(parts) >= 2 else ""
    municipio = parts[1] if len(parts) >= 3 else ""
    return (tipo or None, municipio or None)


def file_info(root: Path, path: Path) -> dict[str, object]:
    file_id, rel = relid_for(root, path)
    tipo, municipio = infer_tipo_municipio(rel)
    stat = path.stat()
    return {
        "id": file_id,
        "nome": path.stem,
        "tipo": tipo,
        "municipio": municipio,
        "relpath": rel,
        "ext": path.suffix.lower().lstrip("."),
        "mtime": stat.st_mtime,
    }
