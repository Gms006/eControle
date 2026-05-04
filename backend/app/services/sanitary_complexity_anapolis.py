from __future__ import annotations

import io
import re
import time
from typing import Any

import httpx

from app.core.cnae import extract_cnae_codes, normalize_cnae_code


_ANAPOLIS_SANITARY_PDF_URL = (
    "https://sapl.anapolis.go.leg.br/media/sapl/public/normajuridica/2018/6126/lc_no_377-cod_sanitario.pdf"
)
_HTTP_HEADERS = {"User-Agent": "eControle/2.0 (+sanitary-complexity-anapolis)"}
_HTTP_TIMEOUT_SECONDS = 20.0
_CACHE_TTL_SECONDS = 60 * 60 * 24

_CNAE_PATTERN = re.compile(
    r"\b(?:\d{2}\s*[.\s]?\s*\d{2}|\d{4})\s*-\s*\d\s*(?:[/-]\s*\d{2})\b|\b\d{7}\b"
)
_ROMAN_COMPLEXITY_PATTERN = re.compile(r"\b(COMPLEXIDADE|GRAU)\s*(I{1,3}|IV|V)\b", re.IGNORECASE)

_CACHE: dict[str, Any] = {"fetched_at": 0.0, "mapping": {}}

_COMPLEXITY_ORDER = {"BAIXA": 1, "MEDIA": 2, "ALTA": 3}


def _max_complexity(left: str | None, right: str | None) -> str | None:
    if left is None:
        return right
    if right is None:
        return left
    return left if _COMPLEXITY_ORDER[left] >= _COMPLEXITY_ORDER[right] else right


def _complexity_from_roman(roman: str) -> str | None:
    token = str(roman or "").strip().upper()
    if token == "I":
        return "BAIXA"
    if token == "II":
        return "MEDIA"
    if token == "III":
        return "ALTA"
    return None


def _normalize_extraction_text(text: str | None) -> str:
    return str(text or "")


def _cnae_digits(value: str | None) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) != 7:
        return None
    return digits


def _cnae_digits_any(value: str | None) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _extract_complexity_token(text: str) -> str | None:
    upper = _normalize_extraction_text(text).upper()
    if not upper:
        return None
    if "ALTA" in upper:
        return "ALTA"
    if "MÉDIA" in upper:
        return "MEDIA"
    if "MEDIA" in upper or "MÃ‰DIA" in upper:
        return "MEDIA"
    if "BAIXA" in upper:
        return "BAIXA"

    match = _ROMAN_COMPLEXITY_PATTERN.search(upper)
    if match:
        return _complexity_from_roman(match.group(2))
    return None


def _extract_cnae_codes_from_text(text: str) -> list[str]:
    found: list[str] = []
    normalized_text = _normalize_extraction_text(text)
    for raw_code in _CNAE_PATTERN.findall(normalized_text):
        cleaned = re.sub(r"\s*-\s*", "-", str(raw_code or ""))
        cleaned = re.sub(r"\s*/\s*", "/", cleaned)
        cleaned = re.sub(r"\s+", "", cleaned)
        normalized = normalize_cnae_code(cleaned)
        if normalized and normalized not in found:
            found.append(normalized)
    return found


def _extract_mapping_from_text(text: str) -> dict[str, str]:
    if not text:
        return {}

    mapping: dict[str, str] = {}
    current_complexity: str | None = None

    for raw_line in text.splitlines():
        line = _normalize_extraction_text(raw_line).strip()
        if not line:
            continue

        line_complexity = _extract_complexity_token(line)
        if line_complexity:
            current_complexity = line_complexity

        codes = _extract_cnae_codes_from_text(line)
        if not codes:
            continue

        effective_complexity = line_complexity or current_complexity
        if not effective_complexity:
            continue

        for code in codes:
            keys = [code]
            digits = _cnae_digits(code)
            if digits:
                keys.append(digits)
                keys.append(digits[:5])
            for key in keys:
                previous = mapping.get(key)
                mapping[key] = _max_complexity(previous, effective_complexity) or effective_complexity

    return mapping


def _fetch_pdf_bytes() -> bytes:
    with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS, headers=_HTTP_HEADERS, follow_redirects=True) as client:
        response = client.get(_ANAPOLIS_SANITARY_PDF_URL)
        response.raise_for_status()
    return response.content


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text:
            parts.append(page_text)
    return "\n".join(parts)


def _load_annex_mapping() -> dict[str, str]:
    now = time.time()
    cached_mapping = _CACHE.get("mapping")
    cached_at = float(_CACHE.get("fetched_at") or 0.0)
    if isinstance(cached_mapping, dict) and cached_mapping and (now - cached_at) < _CACHE_TTL_SECONDS:
        return cached_mapping

    pdf_bytes = _fetch_pdf_bytes()
    text = _extract_text_from_pdf(pdf_bytes)
    mapping = _extract_mapping_from_text(text)
    if not mapping:
        raise RuntimeError("NÃ£o foi possÃ­vel extrair CNAEs do Anexo Ãšnico (mapeamento vazio).")
    _CACHE["mapping"] = mapping
    _CACHE["fetched_at"] = now
    return mapping


def infer_sanitary_complexity_from_cnaes(*sources: Any) -> str | None:
    cnaes = extract_cnae_codes(*sources)
    if not cnaes:
        return None

    try:
        mapping = _load_annex_mapping()
    except Exception:
        return None

    result: str | None = None
    for cnae in cnaes:
        all_digits = _cnae_digits_any(cnae)
        complexity = (
            mapping.get(cnae)
            or (mapping.get(all_digits) if len(all_digits) == 7 else None)
            or (mapping.get(all_digits[:5]) if len(all_digits) >= 5 else None)
        )
        result = _max_complexity(result, complexity)
    return result or "NAO_APLICAVEL"

