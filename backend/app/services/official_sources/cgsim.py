from __future__ import annotations

import re

import httpx

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_HTTP_TIMEOUT_SECONDS = 12.0
_HTTP_HEADERS = {"User-Agent": "eControle/2.0 (+official-source-parser)"}

_PRIMARY_DOC_URL = (
    "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/"
    "comite-para-gestao-da-rede-nacional-para-a-simplificacao-do-registro-e-da-legalizacao-"
    "de-empresas-e-negocios-cgsim/resolucoes-cgsim"
)
_VIEW_DOC_URL = f"{_PRIMARY_DOC_URL}/view"
_INDEX_URL = (
    "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/"
    "comite-para-gestao-da-rede-nacional-para-a-simplificacao-do-registro-e-da-legalizacao-"
    "de-empresas-e-negocios-cgsim"
)


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


def _extract_discovered_official_link(index_text: str) -> str | None:
    links = re.findall(r'https?://[^"\'\s>]+', index_text)
    for link in links:
        lowered = link.lower()
        if "cgsim" in lowered and ("resol" in lowered or lowered.endswith(".pdf")):
            return link
    return None


def _tier_from_snippet(snippet: str, *, semi_real_mode: bool) -> str:
    text = snippet.upper()
    if "ALTO" in text or "GRAU III" in text:
        return "HIGH"
    if "BAIXO" in text or "GRAU I" in text:
        return "LOW"
    if semi_real_mode:
        return "MEDIUM"
    return "MEDIUM"


def _weight_from_tier(tier: str) -> int:
    if tier == "HIGH":
        return 60
    if tier == "LOW":
        return 15
    return 35


def _fetch_cgsim_text() -> tuple[str, str, bool]:
    errors: list[str] = []
    direct_403 = False

    with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS, headers=_HTTP_HEADERS, follow_redirects=True) as client:
        for attempt_url in (_PRIMARY_DOC_URL, _VIEW_DOC_URL):
            try:
                response = client.get(attempt_url)
                if response.status_code == 403:
                    if attempt_url == _PRIMARY_DOC_URL:
                        direct_403 = True
                    errors.append(f"{attempt_url}: HTTP 403")
                    continue
                response.raise_for_status()
                return _decode_text(response.content), attempt_url, False
            except Exception as exc:
                errors.append(f"{attempt_url}: {exc}")

        try:
            index_response = client.get(_INDEX_URL)
            index_response.raise_for_status()
            index_text = _decode_text(index_response.content)
            discovered_link = _extract_discovered_official_link(index_text)
            if discovered_link:
                try:
                    discovered_response = client.get(discovered_link)
                    discovered_response.raise_for_status()
                    return _decode_text(discovered_response.content), discovered_link, False
                except Exception as exc:
                    errors.append(f"{discovered_link}: {exc}")
            if direct_403:
                # Semi-real mode: gov.br blocked direct URL, keep official index traceability.
                return index_text, _INDEX_URL, True
        except Exception as exc:
            errors.append(f"{_INDEX_URL}: {exc}")

    raise RuntimeError(f"CGSIM official source unavailable: {'; '.join(errors)}")


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []

    source_text, used_reference, semi_real_mode = _fetch_cgsim_text()
    snippets = _extract_cnae_snippets(normalized, source_text)
    if not snippets:
        return []

    primary_snippet = snippets[0]
    tier = _tier_from_snippet(primary_snippet, semi_real_mode=semi_real_mode)
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="general",
            official_result=(
                f"Classificacao transversal CGSIM localizada para CNAE {normalized}"
                + (" em modo semi-real por bloqueio HTTP 403 da URL direta." if semi_real_mode else ".")
            ),
            suggested_risk_tier=tier,
            suggested_base_weight=_weight_from_tier(tier),
            source_name="CGSIM",
            source_reference=used_reference,
            evidence_excerpt=primary_snippet,
            confidence=0.72 if semi_real_mode else 0.8,
            requires_questionnaire=semi_real_mode,
        )
    ]
