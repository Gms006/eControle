"""Utility functions used across ETL steps."""
from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from datetime import date, datetime, timedelta
from typing import Any

EXCEL_EPOCH = date(1899, 12, 30)
_DIGITS_RE = re.compile(r"\D+")
_RE_NOT_DIGIT_COMMA_DOT = re.compile(r"[^0-9,.\-]+")


def only_digits(value: Any | None) -> str | None:
    """Return only the numeric characters of *value* or ``None`` if empty."""
    if value is None:
        return None
    if isinstance(value, int):
        digits = f"{value:d}"
    elif isinstance(value, float):
        if math.isnan(value):
            return None
        digits = f"{int(value):d}"
    else:
        digits = _DIGITS_RE.sub("", str(value))
    return digits or None


def strip_accents(value: str) -> str:
    """Normalize a string removing accents for matching purposes."""
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_text(value: Any | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_date_br(value: Any | None) -> date | None:
    """Parse dates in dd/mm/yyyy, yyyy-mm-dd or Excel serial formats."""
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, int):
        return EXCEL_EPOCH + timedelta(days=value)
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return EXCEL_EPOCH + timedelta(days=int(value))
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Data inválida: {value}")


def make_row_hash(table: str, row_number: int, payload_json: str) -> str:
    """Create a deterministic SHA-256 hash for staging rows."""

    digest = hashlib.sha256()
    digest.update(f"{table}::{row_number}||".encode("utf-8"))
    digest.update(payload_json.encode("utf-8"))
    return digest.hexdigest()


def parse_decimal_br(value: Any | None) -> float | None:
    """Parse decimal values that may use Brazilian formatting.

    Strings such as ``"1.234,56"``, ``"1800,00"``, ``"9,00"`` or ``"1234.56"``
    are converted into Python ``float`` numbers. Placeholders like ``"-"`` and
    ``"*"`` as well as units such as ``"m2"``/``"m²"`` are ignored and return
    ``None``. Invalid values also result in ``None`` instead of raising.
    """

    if value is None:
        return None
    text = normalize_text(value)
    if not text or text in {"-", "*"}:
        return None
    cleaned = _RE_NOT_DIGIT_COMMA_DOT.sub("", text)
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None
