from __future__ import annotations

import re

import httpx

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_HTTP_TIMEOUT_SECONDS = 12.0
_HTTP_HEADERS = {"User-Agent": "eControle/2.0 (+official-source-parser)"}

_ANAPOLIS_SOURCES: tuple[dict, ...] = (
    {
        "label": "Lei Municipal 4.438/2025",
        "url": "https://leismunicipais.com.br/a/go/a/anapolis/lei-ordinaria/2025/443/4438/lei-ordinaria-n-4438-2025",
        "domain": "municipal",
        "contextual_default": True,
    },
    {
        "label": "Uso do Solo (Portal Oficial)",
        "url": "https://www.anapolis.go.gov.br/servicos/uso-do-solo/",
        "domain": "municipal",
        "contextual_default": True,
    },
    {
        "label": "LC 349/2016 (Plano Diretor - Anexo V)",
        "url": "https://www.anapolis.go.gov.br/portal/planodiretor/",
        "domain": "environmental",
        "contextual_default": True,
    },
    {
        "label": "LC 377/2018 (Codigo Sanitario - Anexo Unico)",
        "url": "https://www.anapolis.go.gov.br/portal/vigilancia-sanitaria/",
        "domain": "sanitary",
        "contextual_default": False,
    },
)

_CONTEXTUAL_KEYWORDS = (
    "zona",
    "zoneamento",
    "endereco",
    "local",
    "porte",
    "area",
    "pavimento",
    "ni",
    "inscricao",
    "via",
    "macrozona",
    "imovel",
    "analise complementar",
    "analise tecnica",
    "depende",
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


def _fetch_source_text(url: str) -> str:
    with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS, headers=_HTTP_HEADERS, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    return _decode_text(response.content)


def _extract_cnae_snippets(normalized_cnae: str, source_text: str, limit: int = 4) -> list[str]:
    if not source_text:
        return []

    cnae_digits = re.sub(r"\D", "", normalized_cnae)
    variants = {
        normalized_cnae,
        normalized_cnae.replace(".", "").replace("-", "").replace("/", ""),
        cnae_digits,
        f"{normalized_cnae[:2]}.{normalized_cnae[3:5]}-{normalized_cnae[6]}-{normalized_cnae[8:]}",
    }

    pieces = re.split(r"(?<=[.;])\s+|\s{2,}", source_text)
    snippets: list[str] = []
    for piece in pieces:
        candidate = piece.strip()
        if len(candidate) < 12:
            continue
        lowered = candidate.lower()
        if any(variant.lower() in lowered for variant in variants):
            snippets.append(candidate[:360])
            if len(snippets) >= limit:
                break
    return snippets


def _snippet_requires_questionnaire(snippet: str) -> bool:
    lowered = snippet.lower()
    return any(keyword in lowered for keyword in _CONTEXTUAL_KEYWORDS)


def _tier_from_snippet(snippet: str) -> str | None:
    text = snippet.upper()
    if "ALTO" in text or "GRAU III" in text or "COMPLEXIDADE III" in text:
        return "HIGH"
    if "MEDIO" in text or "MÉDIO" in text or "GRAU II" in text or "COMPLEXIDADE II" in text:
        return "MEDIUM"
    if "BAIXO" in text or "GRAU I" in text or "COMPLEXIDADE I" in text:
        return "LOW"
    return None


def _base_weight_from_tier(tier: str | None) -> int | None:
    if tier == "HIGH":
        return 60
    if tier == "MEDIUM":
        return 35
    if tier == "LOW":
        return 15
    return None


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []

    findings: list[OfficialSourceFinding] = []
    errors: list[str] = []
    successful_fetches = 0
    for source in _ANAPOLIS_SOURCES:
        try:
            source_text = _fetch_source_text(source["url"])
            successful_fetches += 1
        except Exception as exc:
            errors.append(f'{source["label"]}: {exc}')
            continue

        for snippet in _extract_cnae_snippets(normalized, source_text):
            contextual = source["contextual_default"] or _snippet_requires_questionnaire(snippet)
            tier = None if contextual else _tier_from_snippet(snippet)
            findings.append(
                OfficialSourceFinding(
                    cnae_code=normalized,
                    domain=source["domain"],
                    official_result=(
                        f'{source["label"]}: regra municipal localizada para CNAE {normalized}.'
                        if not contextual
                        else (
                            f'{source["label"]}: enquadramento parcial para CNAE {normalized},'
                            " dependente de contexto locacional/porte/edificacao."
                        )
                    ),
                    suggested_risk_tier=tier,
                    suggested_base_weight=(
                        _base_weight_from_tier(tier) if source["domain"] == "municipal" else None
                    ),
                    source_name="ANAPOLIS",
                    source_reference=source["url"],
                    evidence_excerpt=f'{source["label"]}: {snippet}',
                    confidence=0.82 if not contextual else 0.66,
                    requires_questionnaire=contextual,
                )
            )

    if findings:
        return findings
    if successful_fetches == 0 and errors:
        raise RuntimeError(f"ANAPOLIS official sources unavailable: {'; '.join(errors)}")
    return []
