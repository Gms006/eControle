from __future__ import annotations

import re

import httpx

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_HTTP_TIMEOUT_SECONDS = 12.0
_HTTP_HEADERS = {"User-Agent": "eControle/2.0 (+official-source-parser)"}

_IN66_URL = "https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/atos-normativos/instrucao-normativa-66-2020"
_RDC153_URL = "https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/atos-normativos/rdc-153-2017"


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            decoded = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        decoded = content.decode("utf-8", errors="ignore")
    return re.sub(r"\s+", " ", decoded).strip()


def _fetch_source_text(url: str) -> str:
    with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS, headers=_HTTP_HEADERS, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    return _decode_text(response.content)


def _extract_cnae_snippets(normalized_cnae: str, source_text: str, limit: int = 4) -> list[str]:
    cnae_digits = re.sub(r"\D", "", normalized_cnae)
    variants = {
        normalized_cnae.lower(),
        normalized_cnae.replace(".", "").replace("-", "").replace("/", "").lower(),
        cnae_digits.lower(),
    }
    snippets: list[str] = []
    for chunk in re.split(r"(?<=[.;])\s+|\s{2,}", source_text):
        candidate = chunk.strip()
        if len(candidate) < 12:
            continue
        lowered = candidate.lower()
        if any(variant in lowered for variant in variants):
            snippets.append(candidate[:360])
            if len(snippets) >= limit:
                break
    return snippets


def _tier_from_snippet(snippet: str) -> str:
    text = snippet.upper()
    if "ALTO" in text or "CLASSE III" in text or "GRAU III" in text:
        return "HIGH"
    if "BAIXO" in text or "CLASSE I" in text or "GRAU I" in text:
        return "LOW"
    return "MEDIUM"


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []

    fetch_errors: list[str] = []
    in66_text = ""
    rdc153_text = ""
    try:
        in66_text = _fetch_source_text(_IN66_URL)
    except Exception as exc:
        fetch_errors.append(f"IN 66/2020: {exc}")
    try:
        rdc153_text = _fetch_source_text(_RDC153_URL)
    except Exception as exc:
        fetch_errors.append(f"RDC 153/2017: {exc}")

    if not in66_text and not rdc153_text:
        raise RuntimeError(f"ANVISA official sources unavailable: {'; '.join(fetch_errors)}")

    snippets = _extract_cnae_snippets(normalized, in66_text)
    if not snippets:
        snippets = _extract_cnae_snippets(normalized, rdc153_text)
    if not snippets:
        return []

    primary_snippet = snippets[0]
    tier = _tier_from_snippet(primary_snippet)
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="sanitary",
            official_result=(
                f"Classificacao sanitaria identificada em fonte oficial ANVISA para o CNAE {normalized}"
                " (IN 66/2020 com suporte semantico da RDC 153/2017)."
            ),
            suggested_risk_tier=tier,
            suggested_base_weight=None,
            source_name="ANVISA",
            source_reference=_IN66_URL if in66_text else _RDC153_URL,
            evidence_excerpt=primary_snippet,
            confidence=0.85,
            requires_questionnaire=False,
        )
    ]
