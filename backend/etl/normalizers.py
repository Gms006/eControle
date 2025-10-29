"""Utility functions used across ETL steps."""
from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
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


def parse_date_br(value: Any) -> date:
    """Parse dates in dd/mm/yyyy, yyyy-mm-dd or Excel serial formats."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    if value is None:
        raise ValueError("Data inválida: None")

    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            raise ValueError("Data inválida: NaN")
        return EXCEL_EPOCH + timedelta(days=int(value))

    s = str(value).strip()
    if s in ("", "-", "*"):
        raise ValueError(f"Data inválida: {value}")

    if " " in s:
        s = s.split(" ", 1)[0]

    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    if s.isdigit():
        return EXCEL_EPOCH + timedelta(days=int(s))

    try:
        serial = float(s)
    except ValueError as exc:
        raise ValueError(f"Data inválida: {value}") from exc

    if math.isnan(serial):
        raise ValueError(f"Data inválida: {value}")

    return EXCEL_EPOCH + timedelta(days=int(serial))


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
