from __future__ import annotations


def normalize_fs_dirname(value: str | None) -> str | None:
    """Normalize and validate company folder alias used under G:/EMPRESAS/{PASTA}."""
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized:
        return None

    if ".." in normalized or "/" in normalized or "\\" in normalized or ":" in normalized:
        raise ValueError("fs_dirname contem caracteres invalidos de caminho")

    return normalized
