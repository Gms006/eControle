from __future__ import annotations

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_SOURCE_REFERENCE = "https://www.goiania.go.gov.br/"

_GOIANIA_RULES: dict[str, list[dict]] = {
    "56.11-2-01": [
        {
            "domain": "municipal",
            "official_result": "ALF: atividade com risco municipal intermediário para licenciamento local.",
            "suggested_risk_tier": "MEDIUM",
            "suggested_base_weight": 30,
            "confidence": 0.75,
            "evidence_excerpt": "Anexo municipal indica exigências de regularidade contínua para funcionamento.",
        },
        {
            "domain": "environmental",
            "official_result": "AMMA: potencial de impacto ambiental localizado em baixa escala.",
            "suggested_risk_tier": "LOW",
            "suggested_base_weight": None,
            "confidence": 0.68,
            "evidence_excerpt": "Atividade pode depender de avaliação ambiental simplificada.",
        },
    ],
    "41.20-4-00": [
        {
            "domain": "environmental",
            "official_result": "AMMA: atividade com potencial de impacto ambiental relevante.",
            "suggested_risk_tier": "MEDIUM",
            "suggested_base_weight": None,
            "confidence": 0.74,
            "evidence_excerpt": "Necessidade de controle ambiental municipal por tipo de operação.",
        }
    ],
}


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []
    rules = _GOIANIA_RULES.get(normalized, [])
    findings: list[OfficialSourceFinding] = []
    for rule in rules:
        findings.append(
            OfficialSourceFinding(
                cnae_code=normalized,
                domain=rule["domain"],
                official_result=rule["official_result"],
                suggested_risk_tier=rule.get("suggested_risk_tier"),
                suggested_base_weight=rule.get("suggested_base_weight"),
                source_name="GOIANIA",
                source_reference=_SOURCE_REFERENCE,
                evidence_excerpt=rule["evidence_excerpt"],
                confidence=rule["confidence"],
                requires_questionnaire=False,
            )
        )
    return findings
