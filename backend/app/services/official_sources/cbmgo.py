from __future__ import annotations

from app.core.cnae import normalize_cnae_code
from app.schemas.official_sources import OfficialSourceFinding


_SOURCE_REFERENCE = "https://www.bombeiros.go.gov.br/"
_NT_01_2025 = "https://www.bombeiros.go.gov.br/normas-tecnicas/nt-01-2025/"
_NT_01_2025_ANEXO = "https://www.bombeiros.go.gov.br/normas-tecnicas/nt-01-2025/anexo/"
_NT_14_2025 = "https://www.bombeiros.go.gov.br/normas-tecnicas/nt-14-2025/"


def lookup_cnae(cnae_code: str) -> list[OfficialSourceFinding]:
    normalized = normalize_cnae_code(cnae_code)
    if not normalized:
        return []
    return [
        OfficialSourceFinding(
            cnae_code=normalized,
            domain="fire",
            official_result=(
                "Referencias CBMGO (NT 01/2025, anexo e NT 14/2025) exigem"
                " contexto de ocupacao/edificacao/carga de incendio para classificacao final."
            ),
            suggested_risk_tier=None,
            suggested_base_weight=None,
            source_name="CBMGO",
            source_reference=f"{_SOURCE_REFERENCE} | {_NT_01_2025} | {_NT_01_2025_ANEXO} | {_NT_14_2025}",
            evidence_excerpt=(
                "Apenas CNAE nao determina risco final de incendio; manter questionario tecnico complementar."
            ),
            confidence=0.62,
            requires_questionnaire=True,
        )
    ]
