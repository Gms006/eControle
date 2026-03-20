from __future__ import annotations

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_SOURCE_REFERENCE = "https://www.bombeiros.go.gov.br/"


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="fire",
            official_result=(
                "Referência de segurança contra incêndio depende de carga de incêndio, área, altura e ocupação detalhada."
            ),
            suggested_risk_tier=None,
            suggested_base_weight=None,
            source_name="CBMGO",
            source_reference=_SOURCE_REFERENCE,
            evidence_excerpt=(
                "Apenas CNAE não determina risco final de incêndio; exige questionário técnico complementar."
            ),
            confidence=0.55,
            requires_questionnaire=True,
        )
    ]
