from __future__ import annotations

import re
from typing import Any

TEMPORAL_TOKENS = (
    "hoje",
    "agora",
    "atual",
    "atualizado",
    "atualização",
    "2026",
    "mudou",
    "vigente",
    "recent",
    "recente",
)

SOURCE_TOKENS = (
    "fonte",
    "referência",
    "referencia",
    "cite",
    "citação",
    "citacao",
    "base legal",
    "fundamento",
    "link oficial",
)

REGULATORY_TOKENS = (
    "tpi",
    "cnae",
    "anápolis",
    "anapolis",
    "prefeitura",
    "municipal",
    "legislação",
    "legislacao",
    "lei",
    "decreto",
    "norma",
    "portaria",
    "resolução",
    "resolucao",
)

INTERNAL_COMPANY_TOKENS = (
    "essa empresa",
    "desta empresa",
    "da empresa",
    "esta empresa",
    "nosso cadastro",
    "nossa base",
    "dados internos",
)


def should_search_web(question: str, company_context: dict[str, Any] | None = None) -> bool:
    text = str(question or "").strip().lower()
    if not text:
        return False

    if any(token in text for token in INTERNAL_COMPANY_TOKENS):
        return False

    asks_for_source = any(token in text for token in SOURCE_TOKENS)
    asks_temporal = any(token in text for token in TEMPORAL_TOKENS)
    regulatory_signal = any(token in text for token in REGULATORY_TOKENS)
    explicit_question = bool(re.search(r"\b(como|quando|qual|quais|quem|onde|por que|porque)\b", text))

    if asks_for_source or asks_temporal:
        return True
    if regulatory_signal and explicit_question:
        return True
    if "cnae" in text and "risco" in text:
        return True
    if "tpi" in text:
        return True

    company_id = str((company_context or {}).get("company_id") or "").strip()
    if company_id and ("interno" in text or "cadastro" in text):
        return False
    return False
