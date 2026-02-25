from __future__ import annotations

import hashlib
import re


_ONLY_DIGITS = re.compile(r"\D+")
_MOJIBAKE_HINTS = ("Ã", "Â", "â", "ð", "Ð", "�")


def normalize_digits(value: str) -> str:
    return _ONLY_DIGITS.sub("", value or "")


def normalize_cnpj(value: str) -> str:
    return normalize_digits(value)


def compute_sha256(payload_bytes: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload_bytes).hexdigest()


def _mojibake_score(value: str) -> int:
    return sum(value.count(ch) for ch in _MOJIBAKE_HINTS)


def repair_mojibake_utf8(value):
    """
    Best-effort fix for common mojibake where UTF-8 bytes were decoded as latin-1/cp1252.
    Example: 'NÂº EscritÃ³rio' -> 'Nº Escritório'
    """
    if not isinstance(value, str):
        return value
    if not value or not any(ch in value for ch in _MOJIBAKE_HINTS):
        return value
    try:
        repaired = value.encode("latin-1").decode("utf-8")
    except Exception:
        return value
    if not repaired or "\ufffd" in repaired:
        return value
    if _mojibake_score(repaired) > _mojibake_score(value):
        return value
    return repaired


def sanitize_text_tree(value):
    if isinstance(value, str):
        return repair_mojibake_utf8(value)
    if isinstance(value, list):
        return [sanitize_text_tree(v) for v in value]
    if isinstance(value, dict):
        return {k: sanitize_text_tree(v) for k, v in value.items()}
    return value


_NULL_MARKERS = {"-", "*"}


def null_if_marker(value):
    if value is None:
        return None
    v = repair_mojibake_utf8(str(value)).strip()
    return None if v in _NULL_MARKERS else v
