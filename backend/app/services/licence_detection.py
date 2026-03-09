from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import re
import unicodedata


DATE_RE = re.compile(r"(?<!\d)(\d{2})[./-](\d{2})[./-](\d{4})(?!\d)")
TOKEN_RE = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class LicenceSuggestion:
    original_filename: str
    suggested_group: str | None
    suggested_document_kind: str | None
    suggested_expires_at: date | None
    is_definitive: bool
    confidence: float
    evidence_snippets: list[str]
    canonical_filename: str | None
    warnings: list[str]
    mapped_field: str | None
    extension: str


@dataclass(frozen=True)
class _KindSpec:
    group: str
    kind: str
    field: str
    canonical_label: str
    supports_definitive: bool
    supports_expiry: bool
    requires_expiry: bool


KIND_SPECS: dict[str, _KindSpec] = {
    "ALVARA_BOMBEIROS": _KindSpec("BOMBEIROS", "ALVARA_BOMBEIROS", "cercon", "Alvará Bombeiros", False, True, True),
    "ALVARA_VIG_SANITARIA": _KindSpec(
        "SANITARIA", "ALVARA_VIG_SANITARIA", "alvara_vig_sanitaria", "Alvará Vig Sanitária", False, True, True
    ),
    "DISPENSA_SANITARIA": _KindSpec(
        "SANITARIA", "DISPENSA_SANITARIA", "alvara_vig_sanitaria", "Dispensa Sanitária", True, True, False
    ),
    "ALVARA_FUNCIONAMENTO_DEFINITIVO": _KindSpec(
        "FUNCIONAMENTO",
        "ALVARA_FUNCIONAMENTO_DEFINITIVO",
        "alvara_funcionamento",
        "Alvará Funcionamento",
        True,
        False,
        False,
    ),
    "ALVARA_FUNCIONAMENTO_CONDICIONADO": _KindSpec(
        "FUNCIONAMENTO",
        "ALVARA_FUNCIONAMENTO_CONDICIONADO",
        "alvara_funcionamento",
        "Alvará Funcionamento - Condicionado",
        False,
        True,
        True,
    ),
    "ALVARA_FUNCIONAMENTO_PROVISORIO": _KindSpec(
        "FUNCIONAMENTO",
        "ALVARA_FUNCIONAMENTO_PROVISORIO",
        "alvara_funcionamento",
        "Alvará Funcionamento - Provisório",
        False,
        True,
        True,
    ),
    "USO_DO_SOLO": _KindSpec("USO_SOLO", "USO_DO_SOLO", "certidao_uso_solo", "Uso do Solo", False, True, True),
    "LICENCA_AMBIENTAL": _KindSpec(
        "AMBIENTAL", "LICENCA_AMBIENTAL", "licenca_ambiental", "Licença Ambiental", False, True, True
    ),
    "DISPENSA_AMBIENTAL": _KindSpec(
        "AMBIENTAL", "DISPENSA_AMBIENTAL", "licenca_ambiental", "Dispensa Ambiental", True, True, False
    ),
}


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize(value: str) -> str:
    text = _strip_accents(str(value or "")).lower()
    text = text.replace("-", " ").replace("_", " ").replace("/", " ").replace(".", " ")
    return re.sub(r"\s+", " ", text).strip()


def _score_kind(tokens: set[str], normalized: str, kind: str) -> tuple[int, list[str]]:
    score = 0
    evidence: list[str] = []

    def has(*items: str) -> bool:
        return all(item in tokens for item in items)

    if kind == "ALVARA_BOMBEIROS" and (has("bombeiros") or "cercon" in tokens):
        score += 3
        evidence.append("keyword: bombeiros/cercon")
    if kind == "ALVARA_VIG_SANITARIA" and "sanitaria" in tokens and "dispensa" not in tokens:
        score += 3
        evidence.append("keyword: alvara vig sanitaria")
    if kind == "DISPENSA_SANITARIA" and "dispensa" in tokens and "sanitaria" in tokens:
        score += 4
        evidence.append("keyword: dispensa sanitaria")
    if kind == "ALVARA_FUNCIONAMENTO_DEFINITIVO" and "funcionamento" in tokens and "definitivo" in tokens:
        score += 4
        evidence.append("keyword: funcionamento definitivo")
    if kind == "ALVARA_FUNCIONAMENTO_CONDICIONADO" and "funcionamento" in tokens and "condicionado" in tokens:
        score += 4
        evidence.append("keyword: funcionamento condicionado")
    if kind == "ALVARA_FUNCIONAMENTO_PROVISORIO" and "funcionamento" in tokens and (
        "provisorio" in tokens or "provisoria" in tokens
    ):
        score += 4
        evidence.append("keyword: funcionamento provisorio")
    if kind == "USO_DO_SOLO" and "uso" in tokens and "solo" in tokens:
        score += 4
        evidence.append("keyword: uso do solo")
    if kind == "LICENCA_AMBIENTAL" and "ambiental" in tokens and "dispensa" not in tokens:
        score += 3
        evidence.append("keyword: licenca ambiental")
    if kind == "DISPENSA_AMBIENTAL" and "dispensa" in tokens and "ambiental" in tokens:
        score += 4
        evidence.append("keyword: dispensa ambiental")

    if "alvara" in tokens and kind.startswith("ALVARA_"):
        score += 1
    if "licenca" in tokens and kind == "LICENCA_AMBIENTAL":
        score += 1
    if "dispensa" in tokens and kind.startswith("DISPENSA_"):
        score += 1
    if "funcionamento" in tokens and kind.startswith("ALVARA_FUNCIONAMENTO_"):
        score += 1
    if "vig" in tokens and kind == "ALVARA_VIG_SANITARIA":
        score += 1

    if "definitivo" in normalized and kind.endswith("DEFINITIVO"):
        score += 2

    return score, evidence


def _extract_dates(filename: str) -> list[tuple[date, int, int, str]]:
    found: list[tuple[date, int, int, str]] = []
    for match in DATE_RE.finditer(filename):
        day, month, year = match.groups()
        try:
            parsed = date(int(year), int(month), int(day))
        except ValueError:
            continue
        found.append((parsed, match.start(), match.end(), f"{day}.{month}.{year}"))
    return found


def _pick_expiry(filename: str, normalized: str, dates: list[tuple[date, int, int, str]]) -> tuple[date | None, str | None]:
    if not dates:
        return None, None

    val_positions = [m.start() for m in re.finditer(r"\bval\b", normalized)]
    if val_positions:
        best: tuple[int, date, str] | None = None
        for parsed, start, _end, br_date in dates:
            distance = min(abs(start - pos) for pos in val_positions)
            candidate = (distance, parsed, br_date)
            if best is None or candidate[0] < best[0] or (candidate[0] == best[0] and candidate[1] > best[1]):
                best = candidate
        if best:
            return best[1], f"date near token 'Val': {best[2]}"

    best_date = max(item[0] for item in dates)
    br = best_date.strftime("%d.%m.%Y")
    return best_date, f"largest valid date: {br}"


def parse_filename_to_suggestion(filename: str) -> LicenceSuggestion:
    original = str(filename or "").strip()
    basename = original.split("\\")[-1].strip()
    if basename.lower().startswith("c:/fakepath/"):
        basename = basename[len("c:/fakepath/") :]
    if basename.lower().startswith("fakepath/"):
        basename = basename[len("fakepath/") :]
    extension_match = re.search(r"\.([A-Za-z0-9]+)$", basename)
    extension = extension_match.group(1).lower() if extension_match else ""
    normalized = _normalize(basename)
    tokens = set(TOKEN_RE.findall(normalized))
    warnings: list[str] = []
    evidence: list[str] = []

    is_definitive = "definitivo" in tokens
    if is_definitive:
        evidence.append("token: definitivo")

    dates = _extract_dates(basename)
    expiry, expiry_reason = _pick_expiry(basename, normalized, dates)
    if expiry_reason:
        evidence.append(expiry_reason)

    ranked: list[tuple[int, str, list[str]]] = []
    for kind in KIND_SPECS:
        score, kind_evidence = _score_kind(tokens, normalized, kind)
        if score > 0:
            ranked.append((score, kind, kind_evidence))
    ranked.sort(key=lambda item: item[0], reverse=True)

    if not ranked:
        warnings.append("Could not infer document kind from filename")
        return LicenceSuggestion(
            original_filename=basename,
            suggested_group=None,
            suggested_document_kind=None,
            suggested_expires_at=expiry,
            is_definitive=is_definitive,
            confidence=0.0,
            evidence_snippets=evidence[:4],
            canonical_filename=None,
            warnings=warnings,
            mapped_field=None,
            extension=extension,
        )

    top_score, top_kind, top_evidence = ranked[0]
    spec = KIND_SPECS[top_kind]
    evidence.extend(top_evidence)

    if is_definitive and not spec.supports_definitive:
        warnings.append("Token 'Definitivo' ignored for this document kind")
    if not is_definitive and spec.requires_expiry and expiry is None:
        warnings.append("Validity date not found")
    if len(ranked) > 1 and ranked[0][0] == ranked[1][0]:
        warnings.append("Ambiguous classification; please review manually")

    confidence = min(1.0, max(0.1, 0.25 + 0.12 * top_score - (0.1 if warnings else 0.0)))
    suggestion = LicenceSuggestion(
        original_filename=basename,
        suggested_group=spec.group,
        suggested_document_kind=spec.kind,
        suggested_expires_at=expiry if spec.supports_expiry else None,
        is_definitive=is_definitive and spec.supports_definitive,
        confidence=round(confidence, 2),
        evidence_snippets=evidence[:4],
        canonical_filename=None,
        warnings=warnings,
        mapped_field=spec.field,
        extension=extension or "pdf",
    )
    canonical = build_canonical_filename(suggestion)
    return LicenceSuggestion(**{**suggestion.__dict__, "canonical_filename": canonical})


def build_canonical_filename(suggestion: LicenceSuggestion) -> str | None:
    kind = suggestion.suggested_document_kind
    if not kind or kind not in KIND_SPECS:
        return None
    spec = KIND_SPECS[kind]
    ext = suggestion.extension or "pdf"
    if suggestion.is_definitive and spec.supports_definitive:
        return f"{spec.canonical_label} - Definitivo.{ext}"
    if suggestion.suggested_expires_at and spec.supports_expiry:
        return f"{spec.canonical_label} - Val {suggestion.suggested_expires_at.strftime('%d.%m.%Y')}.{ext}"
    return None


def compare_suggestions_for_same_group(a: LicenceSuggestion, b: LicenceSuggestion) -> LicenceSuggestion:
    if a.is_definitive != b.is_definitive:
        return a if a.is_definitive else b
    a_expiry = a.suggested_expires_at
    b_expiry = b.suggested_expires_at
    if a_expiry and b_expiry and a_expiry != b_expiry:
        return a if a_expiry > b_expiry else b
    if a_expiry and not b_expiry:
        return a
    if b_expiry and not a_expiry:
        return b
    if a.confidence != b.confidence:
        return a if a.confidence >= b.confidence else b
    return a
