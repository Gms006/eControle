from __future__ import annotations

import hashlib
import re


_ONLY_DIGITS = re.compile(r"\D+")


def normalize_digits(value: str) -> str:
    return _ONLY_DIGITS.sub("", value or "")


def normalize_cnpj(value: str) -> str:
    return normalize_digits(value)


def compute_sha256(payload_bytes: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload_bytes).hexdigest()


_NULL_MARKERS = {"-", "*"}


def null_if_marker(value):
    if value is None:
        return None
    v = str(value).strip()
    return None if v in _NULL_MARKERS else v
