from __future__ import annotations

import re
from typing import Any


_ONLY_DIGITS = re.compile(r"\D+")
_WHITESPACE = re.compile(r"\s+")
_INVALID_CNAE_MARKERS = {
    "********",
    "-",
    "N/A",
    "NAO INFORMADA",
    "NAO INFORMADO",
    "NÃO INFORMADA",
    "NÃO INFORMADO",
    "SEM CNAE",
    "00.00-0-00",
}


def _normalize_spaces(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    return _WHITESPACE.sub(" ", text)


def normalize_cnae_code(value: Any) -> str | None:
    text = _normalize_spaces(value)
    if not text:
        return None

    upper_text = text.upper()
    if upper_text in _INVALID_CNAE_MARKERS:
        return None

    digits = _ONLY_DIGITS.sub("", text)
    if not digits:
        return None
    if digits == "0000000":
        return None
    if len(digits) == 7:
        return f"{digits[:2]}.{digits[2:4]}-{digits[4]}-{digits[5:]}"

    return upper_text


def normalize_cnae_list(items: Any) -> list[dict[str, str]]:
    if not isinstance(items, list):
        return []

    result: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        code = normalize_cnae_code(item.get("code"))
        text = _normalize_spaces(item.get("text")) or ""
        if not code and not text:
            continue
        result.append({"code": code or "", "text": text})
    return result


def extract_cnae_codes(*sources: Any) -> list[str]:
    result: set[str] = set()
    for source in sources:
        if not isinstance(source, list):
            continue
        for item in source:
            if not isinstance(item, dict):
                continue
            code = normalize_cnae_code(item.get("code"))
            if code:
                result.add(code)
    return sorted(result)
