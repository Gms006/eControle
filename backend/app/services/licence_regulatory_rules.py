from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Iterable

from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess


INVALIDATING_REASON_VALUES = ("CNAE", "RAZAO_SOCIAL", "NOME_FANTASIA", "ENDERECO")
REASON_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "CNAE": (
        re.compile(r"\bcnae\b"),
    ),
    "RAZAO_SOCIAL": (
        re.compile(r"\brazao\s+social\b"),
    ),
    "NOME_FANTASIA": (
        re.compile(r"\bnome\s+fantasia\b"),
    ),
    "ENDERECO": (
        re.compile(r"\bendereco\b"),
    ),
}


def _normalize_text(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text)


def _has_definitive_alvara(licence: CompanyLicence | None) -> bool:
    if not licence:
        return False
    return str(getattr(licence, "alvara_funcionamento_kind", "") or "").strip().upper() == "DEFINITIVO"


def _process_is_prefeitura_context(process: CompanyProcess) -> bool:
    orgao = _normalize_text(process.orgao)
    extra = process.extra if isinstance(process.extra, dict) else {}
    extra_orgao = _normalize_text(extra.get("orgao"))
    combined = " ".join(part for part in (orgao, extra_orgao) if part).strip()
    return "prefeitura" in combined


def _process_has_alteration_context(process: CompanyProcess) -> bool:
    tokens = [
        _normalize_text(process.process_type),
        _normalize_text(process.operacao),
    ]
    extra = process.extra if isinstance(process.extra, dict) else {}
    tokens.extend(
        [
            _normalize_text(extra.get("operacao")),
            _normalize_text(extra.get("assunto")),
        ]
    )
    return any("alter" in token for token in tokens if token)


def _match_invalidating_reasons(obs: str | None) -> list[str]:
    normalized = _normalize_text(obs)
    if not normalized:
        return []

    reasons: list[str] = []
    if "alter" not in normalized:
        return reasons

    for reason in INVALIDATING_REASON_VALUES:
        patterns = REASON_PATTERNS[reason]
        if any(pattern.search(normalized) for pattern in patterns):
            reasons.append(reason)
    return reasons


def format_invalidating_reason_label(reason: str | None) -> str:
    key = str(reason or "").strip().upper()
    if key == "CNAE":
        return "CNAE"
    if key == "RAZAO_SOCIAL":
        return "Razão social"
    if key == "NOME_FANTASIA":
        return "Nome fantasia"
    if key == "ENDERECO":
        return "Endereço"
    return str(reason or "").strip()


def _process_reference(process: CompanyProcess) -> str:
    protocolo = str(process.protocolo or "").strip()
    if protocolo:
        return protocolo
    return str(process.id)


def _reference_timestamp(licence: CompanyLicence | None) -> datetime | None:
    if not licence:
        return None
    return getattr(licence, "updated_at", None) or getattr(licence, "created_at", None)


def evaluate_definitive_alvara_regulatory_status(
    *,
    licence: CompanyLicence | None,
    processes: Iterable[CompanyProcess] | None = None,
) -> dict[str, object]:
    has_definitive_alvara = _has_definitive_alvara(licence)
    result: dict[str, object] = {
        "has_definitive_alvara": has_definitive_alvara,
        "definitive_alvara_invalidated": False,
        "regulatory_status": "NOT_APPLICABLE" if not has_definitive_alvara else "VALID",
        "invalidated_reasons": [],
        "invalidating_process_id": None,
        "invalidating_process_ref": None,
        "requires_new_licence_request": False,
    }
    if not has_definitive_alvara:
        return result

    ref_timestamp = _reference_timestamp(licence)
    candidate_processes = sorted(
        list(processes or []),
        key=lambda item: getattr(item, "updated_at", None) or datetime.min,
        reverse=True,
    )
    for process in candidate_processes:
        if not _process_is_prefeitura_context(process):
            continue
        if not _process_has_alteration_context(process):
            continue
        reasons = _match_invalidating_reasons(process.obs)
        if not reasons:
            continue

        process_updated_at = getattr(process, "updated_at", None)
        if ref_timestamp and process_updated_at and process_updated_at <= ref_timestamp:
            continue

        result["definitive_alvara_invalidated"] = True
        result["regulatory_status"] = "INVALIDATED"
        result["invalidated_reasons"] = reasons
        result["invalidating_process_id"] = process.id
        result["invalidating_process_ref"] = _process_reference(process)
        result["requires_new_licence_request"] = True
        return result

    return result
