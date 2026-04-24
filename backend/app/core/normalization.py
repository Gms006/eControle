from __future__ import annotations

# Backward-compatible shim: keep legacy imports working while
# centralizing canonical normalizers in app.core.normalize.
from app.core.normalize import (  # noqa: F401
    GO_MUNICIPIOS_CANONICAL,
    PROCESS_SITUACAO_ACCEPT_MAP,
    PROCESS_SITUACAO_LABELS,
    GENERIC_STATUS_ACCEPT_MAP,
    GENERIC_STATUS_LABELS,
    extract_primary_phone_digits,
    normalize_date_br,
    normalize_generic_status,
    normalize_document_digits,
    normalize_email,
    normalize_municipio,
    normalize_process_type,
    normalize_process_situacao,
    normalize_status,
    normalize_title_case,
    normalize_whitespace,
    strip_accents,
)


def normalize_spaces(value: str | None) -> str:
    return normalize_whitespace(value)
