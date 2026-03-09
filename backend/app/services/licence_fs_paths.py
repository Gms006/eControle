from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import unicodedata


@dataclass(frozen=True)
class LicenceTargetResolution:
    target_dir: Path | None
    unit: str
    structured_layout: bool
    warning: str | None = None


def normalize_token(value: str | None) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def infer_unit_by_cnpj(cnpj: str | None) -> str:
    digits = re.sub(r"\D", "", str(cnpj or ""))
    if len(digits) >= 12 and digits[8:12] == "0001":
        return "Matriz"
    if len(digits) >= 12:
        return "Filial"
    return "Matriz"


def _find_direct_child(parent: Path, expected_name: str) -> Path | None:
    expected_norm = normalize_token(expected_name)
    for child in parent.iterdir():
        if child.is_dir() and normalize_token(child.name) == expected_norm:
            return child
    return None


def detect_structured_layout(base_dir: Path) -> bool:
    if not base_dir.exists() or not base_dir.is_dir():
        return False
    for child in base_dir.iterdir():
        if not child.is_dir():
            continue
        child_norm = normalize_token(child.name)
        if "matriz" in child_norm or "filial" in child_norm:
            return True
        for nested in child.iterdir():
            if nested.is_dir():
                nested_norm = normalize_token(nested.name)
                if "matriz" in nested_norm or "filial" in nested_norm:
                    return True
    return False


def resolve_target_dir(base_dir: Path, *, municipio: str | None, cnpj: str | None) -> LicenceTargetResolution:
    unit = infer_unit_by_cnpj(cnpj)
    structured = detect_structured_layout(base_dir)

    if not structured:
        return LicenceTargetResolution(target_dir=base_dir, unit=unit, structured_layout=False)

    municipio_text = str(municipio or "").strip()
    candidates: list[Path] = []

    if municipio_text:
        candidate_a = _find_direct_child(base_dir, f"{municipio_text} - {unit}")
        if candidate_a:
            candidates.append(candidate_a)

    candidate_b = _find_direct_child(base_dir, unit)
    if candidate_b:
        candidates.append(candidate_b)

    if municipio_text:
        municipio_dir = _find_direct_child(base_dir, municipio_text)
        if municipio_dir:
            nested = _find_direct_child(municipio_dir, unit)
            if nested:
                candidates.append(nested)

    if candidates:
        return LicenceTargetResolution(target_dir=candidates[0], unit=unit, structured_layout=True)

    expected_hint = [f"{municipio_text} - {unit}" if municipio_text else "", unit, f"{municipio_text}/{unit}" if municipio_text else ""]
    hint_text = ", ".join([item for item in expected_hint if item])
    return LicenceTargetResolution(
        target_dir=None,
        unit=unit,
        structured_layout=True,
        warning=f"Structured layout detected but target subdirectory not found. Expected one of: {hint_text}",
    )
