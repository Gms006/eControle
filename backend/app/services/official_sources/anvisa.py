from __future__ import annotations

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_SOURCE_REFERENCE = "https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao"

_SANITARY_RULES: dict[str, dict] = {
    "56.11-2-01": {
        "official_result": "Atividade com manipulação de alimentos, sujeita a vigilância sanitária ativa.",
        "suggested_risk_tier": "HIGH",
        "confidence": 0.9,
        "evidence_excerpt": "Classificação sanitária objetiva para manipulação/preparo de alimentos.",
    },
    "47.89-0-04": {
        "official_result": "Comercialização de animais vivos e insumos com exigência sanitária ampliada.",
        "suggested_risk_tier": "HIGH",
        "confidence": 0.86,
        "evidence_excerpt": "Risco sanitário elevado por potencial exposição biológica.",
    },
}


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []
    rule = _SANITARY_RULES.get(normalized)
    if not rule:
        return []
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="sanitary",
            official_result=rule["official_result"],
            suggested_risk_tier=rule["suggested_risk_tier"],
            suggested_base_weight=None,
            source_name="ANVISA",
            source_reference=_SOURCE_REFERENCE,
            evidence_excerpt=rule["evidence_excerpt"],
            confidence=rule["confidence"],
            requires_questionnaire=False,
        )
    ]
