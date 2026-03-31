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


# Matches trailing UF suffixes as stored by ReceitaWS / BrasilAPI, e.g.:
#   "Anápolis/GO"          → "Anápolis"
#   "Valparaíso de Goiás/GO" → "Valparaíso de Goiás"
#   "Anápolis - GO"        → "Anápolis"
#   "Anápolis - Go"        → "Anápolis"  (case-insensitive)
_UF_SUFFIX_RE = re.compile(r"[\s/\-]+[A-Za-z]{2}\s*$")


def _extract_municipio_name(municipio: str | None) -> str:
    """Return only the city name, stripping any trailing UF code (e.g. '/GO', '- GO')."""
    text = str(municipio or "").strip()
    return _UF_SUFFIX_RE.sub("", text).strip()


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


def _contains_unit_marker(path: Path, unit: str) -> bool:
    child_norm = normalize_token(path.name)
    unit_norm = normalize_token(unit)
    return bool(unit_norm) and unit_norm in child_norm


def _municipio_matches_dir(dir_name: str, municipio_city: str) -> bool:
    """
    Check whether *municipio_city* (already stripped of UF suffix) matches *dir_name*.

    Only tokens longer than 2 characters are required to be present, which
    avoids false negatives caused by short stop-words ("de", "do") that may
    legitimately be absent from an abbreviated folder name, and also protects
    against residual 2-letter UF codes that callers forgot to strip.
    """
    municipio_norm = normalize_token(municipio_city)
    if not municipio_norm:
        return False
    dir_norm = normalize_token(dir_name)
    significant_tokens = [t for t in municipio_norm.split(" ") if len(t) > 2]
    if not significant_tokens:
        # All tokens are very short (unusual); fall back to full match.
        return municipio_norm in dir_norm
    return all(token in dir_norm for token in significant_tokens)


def _is_inactive_dir(path: Path) -> bool:
    return "inativa" in normalize_token(path.name)


def _pick_preferred_dir(candidates: list[Path], *, unit: str) -> Path | None:
    if not candidates:
        return None
    unit_norm = normalize_token(unit)
    ranked = sorted(
        candidates,
        key=lambda item: (
            0 if unit_norm and unit_norm in normalize_token(item.name) else 1,
            1 if _is_inactive_dir(item) else 0,
            normalize_token(item.name),
        ),
    )
    return ranked[0]


def _path_matches_municipio_context(path: Path, *, municipio_city: str, base_dir: Path) -> bool:
    if not municipio_city:
        return True
    current = path
    while True:
        if _municipio_matches_dir(current.name, municipio_city):
            return True
        if current == base_dir or current.parent == current:
            break
        current = current.parent
    return False


def _list_structured_dirs(base_dir: Path) -> list[Path]:
    structured: list[Path] = []
    for child in base_dir.iterdir():
        if not child.is_dir():
            continue
        child_norm = normalize_token(child.name)
        if "matriz" in child_norm or "filial" in child_norm:
            structured.append(child)
        for nested in child.iterdir():
            if not nested.is_dir():
                continue
            nested_norm = normalize_token(nested.name)
            if "matriz" in nested_norm or "filial" in nested_norm:
                structured.append(nested)
    return structured


def detect_structured_layout(base_dir: Path) -> bool:
    if not base_dir.exists() or not base_dir.is_dir():
        return False
    return len(_list_structured_dirs(base_dir)) > 0


def resolve_target_dir(base_dir: Path, *, municipio: str | None, cnpj: str | None) -> LicenceTargetResolution:
    unit = infer_unit_by_cnpj(cnpj)
    structured = detect_structured_layout(base_dir)

    if not structured:
        return LicenceTargetResolution(target_dir=base_dir, unit=unit, structured_layout=False)

    # Strip UF suffix (e.g. "/GO") before any path / token matching so that
    # "Anápolis/GO" correctly matches the folder "Anápolis - Filial".
    municipio_city = _extract_municipio_name(municipio)
    candidates: list[Path] = []

    # A) Exact composed name: "<Município> - <Unidade>"
    if municipio_city:
        candidate_a = _find_direct_child(base_dir, f"{municipio_city} - {unit}")
        if candidate_a:
            candidates.append(candidate_a)

    # B) Plain unit folder: "Matriz" / "Filial"
    candidate_b = _find_direct_child(base_dir, unit)
    if candidate_b:
        candidates.append(candidate_b)

    # C) Nested layout: "<Município>/<Unidade>"
    if municipio_city:
        municipio_dir = _find_direct_child(base_dir, municipio_city)
        if municipio_dir:
            nested = _find_direct_child(municipio_dir, unit)
            if nested:
                candidates.append(nested)

    # D) Fuzzy: any dir that contains the unit marker AND matches the city name
    if municipio_city:
        for child in base_dir.iterdir():
            if not child.is_dir():
                continue
            if _contains_unit_marker(child, unit) and _municipio_matches_dir(child.name, municipio_city):
                candidates.append(child)

    # E) Heuristic fallback: only one active dir of the right unit type exists
    unit_dirs = [child for child in base_dir.iterdir() if child.is_dir() and _contains_unit_marker(child, unit)]
    active_unit_dirs = [child for child in unit_dirs if not _is_inactive_dir(child)]
    if len(active_unit_dirs) == 1:
        candidates.append(active_unit_dirs[0])
    elif len(unit_dirs) == 1:
        candidates.append(unit_dirs[0])

    if candidates:
        seen: set[Path] = set()
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            return LicenceTargetResolution(target_dir=candidate, unit=unit, structured_layout=True)

    fallback_target = _pick_preferred_dir(active_unit_dirs or unit_dirs, unit=unit)
    if fallback_target is not None:
        return LicenceTargetResolution(
            target_dir=fallback_target,
            unit=unit,
            structured_layout=True,
            warning="Structured layout fallback: target subdirectory inferred heuristically.",
        )

    structured_dirs = _list_structured_dirs(base_dir)
    active_structured_dirs = [item for item in structured_dirs if not _is_inactive_dir(item)]
    fallback_structured_pool = active_structured_dirs or structured_dirs
    if municipio_city:
        fallback_structured_pool = [
            item
            for item in fallback_structured_pool
            if _path_matches_municipio_context(item, municipio_city=municipio_city, base_dir=base_dir)
        ]
    fallback_any_structured = _pick_preferred_dir(fallback_structured_pool, unit=unit)
    if fallback_any_structured is not None:
        return LicenceTargetResolution(
            target_dir=fallback_any_structured,
            unit=unit,
            structured_layout=True,
            warning="Structured layout fallback: used generic Matriz/Filial subdirectory.",
        )

    hint_parts = [f"{municipio_city} - {unit}" if municipio_city else "", unit, f"{municipio_city}/{unit}" if municipio_city else ""]
    hint_text = ", ".join([item for item in hint_parts if item])
    return LicenceTargetResolution(
        target_dir=None,
        unit=unit,
        structured_layout=True,
        warning=f"Structured layout detected but target subdirectory not found. Expected one of: {hint_text}",
    )
