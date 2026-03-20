from __future__ import annotations

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_SOURCE_REFERENCE = "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei/atividades-permitidas"

_CGSIM_RULES: dict[str, dict] = {
    "56.11-2-01": {
        "official_result": "Classificação geral de risco médio para fins de licenciamento inicial.",
        "suggested_risk_tier": "MEDIUM",
        "suggested_base_weight": 35,
        "confidence": 0.78,
        "evidence_excerpt": "Referência de licenciamento simplificado aponta necessidade de avaliação municipal complementar.",
    },
    "62.01-5-01": {
        "official_result": "Atividade tipicamente enquadrada em baixo risco no contexto federal simplificado.",
        "suggested_risk_tier": "LOW",
        "suggested_base_weight": 15,
        "confidence": 0.82,
        "evidence_excerpt": "Baixo potencial de impacto direto em saúde pública para a atividade principal.",
    },
}


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []
    rule = _CGSIM_RULES.get(normalized)
    if not rule:
        return []
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="general",
            official_result=rule["official_result"],
            suggested_risk_tier=rule["suggested_risk_tier"],
            suggested_base_weight=rule["suggested_base_weight"],
            source_name="CGSIM",
            source_reference=_SOURCE_REFERENCE,
            evidence_excerpt=rule["evidence_excerpt"],
            confidence=rule["confidence"],
            requires_questionnaire=False,
        )
    ]
