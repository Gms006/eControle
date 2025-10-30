"""Utility functions used across ETL steps."""
from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

_DIGITS_RE = re.compile(r"\D+")
_RE_NOT_DIGIT_COMMA_DOT = re.compile(r"[^0-9,.\-]+")

PLACEHOLDERS = {
    "-",
    "–",
    "—",
    "*",
    "n/a",
    "na",
    "não possui",
    "nao possui",
    "NA",
    "N/A",
}


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


def is_placeholder(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, (date, datetime)):
        return False
    s = str(value).strip().lower()
    return s in PLACEHOLDERS or s == ""


def coerce_placeholder_to_none(value: object):
    return None if is_placeholder(value) else value


def parse_date_br(value: object) -> date:
    """Aceita dd/mm/aaaa, aaaa-mm-dd, datetime string (corta hora) e objetos date/datetime."""
    if value is None:
        raise ValueError("Data inválida: None")
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if is_placeholder(s):
        raise ValueError(f"Data inválida: {value}")
    if " " in s:
        s = s.split(" ", 1)[0]
    if "/" in s:
        d, m, y = s.split("/")
        return date(int(y), int(m), int(d))
    if "-" in s:
        parts = s.split("-")
        if len(parts) != 3:
            raise ValueError(f"Data inválida: {value}")
        if len(parts[0]) == 4:
            y, m, d = parts
        else:
            d, m, y = parts
        return date(int(y), int(m), int(d))
    raise ValueError(f"Data inválida: {value}")


def make_row_hash(table: str, row_number: int, payload_json: str) -> str:
    """Create a deterministic SHA-256 hash for staging rows."""

    digest = hashlib.sha256()
    digest.update(f"{table}::{row_number}||".encode("utf-8"))
    digest.update(payload_json.encode("utf-8"))
    return digest.hexdigest()


def parse_decimal_br(value: Any | None) -> Decimal | None:
    """Parse decimal values that may use Brazilian formatting."""

    if value in (None, "", "-", "*"):
        return None

    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value))
        except InvalidOperation as exc:
            raise ValueError(f"Número inválido: {value}") from exc

    text = str(value).strip()
    if text in ("", "-", "*"):
        return None

    cleaned = _RE_NOT_DIGIT_COMMA_DOT.sub("", text)
    if not cleaned:
        return None
    normalized = cleaned.replace(".", "").replace(",", ".")
    try:
        return Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"Número inválido: {value}") from exc
