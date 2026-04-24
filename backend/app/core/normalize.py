from __future__ import annotations

from datetime import date
import re
import unicodedata


TITLECASE_LOWER_WORDS = {"da", "de", "do", "das", "dos", "e"}
TITLECASE_UPPER_WORDS = {"LTDA", "ME", "EPP", "S/A", "EIRELI", "MEI"}

GO_MUNICIPIOS_CANONICAL = {}

PROCESS_SITUACAO_LABELS = {
    "pendente": "Pendente",
    "em_analise": "Em análise",
    "em_andamento": "Em andamento",
    "aguardando_documento": "Aguardando documento",
    "aguardando_vistoria": "Aguardando vistoria",
    "aguardando_pagamento": "Aguardando pagamento",
    "aguardando_regularizacao": "Aguardando regularização",
    "aguardando_liberacao": "Aguardando liberação",
    "concluido": "Concluído",
    "licenciado": "Licenciado",
    "notificacao": "Notificação",
    "indeferido": "Indeferido",
    "cancelado": "Cancelado",
}

PROCESS_TYPE_ALIASES = {
    "USO_SOLO": "USO_DO_SOLO",
    "CERTIDAO_USO_SOLO": "USO_DO_SOLO",
    "CERTIDAO_DE_USO_DO_SOLO": "USO_DO_SOLO",
    "AMBIENTAL": "LICENCA_AMBIENTAL",
    "LICENCA_AMBIENTE": "LICENCA_AMBIENTAL",
    "ALVARA_VIG_SANITARIA": "ALVARA_SANITARIO",
}

GENERIC_STATUS_LABELS = {
    "possui": "Possui",
    "definitivo": "Definitivo",
    "ativo": "Ativo",
    "inativo": "Inativo",
    "sujeito": "Sujeito",
    "isento": "Isento",
    "nao_possui": "Não possui",
    "nao_exigido": "Não exigido",
    "em_aberto": "Em aberto",
    "regular": "Regular",
    "irregular": "Irregular",
    "em_dia": "Em dia",
    "pago": "Pago",
    "nao_pago": "Não pago",
    "sem_debitos": "Sem débitos",
    "possui_debito": "Possui débito",
    "vencido": "Vencido",
    "valido": "Válido",
    "ir_na_visa": "Ir na Visa",
    "aguardando_documento": "Aguardando documento",
    "aguardando_vistoria": "Aguardando vistoria",
    "aguardando_pagamento": "Aguardando pagamento",
    "aguardando_regularizacao": "Aguardando regularização",
    "aguardando_liberacao": "Aguardando liberação",
    "em_analise": "Em análise",
    "notificacao": "Notificação",
    "vence_dentro_de_7_dias": "Vence dentro de 7 dias",
    "vence_dentro_de_30_dias": "Vence dentro de 30 dias",
}


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def normalize_whitespace(value: str | None) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_document_digits(value: str | None) -> str:
    return re.sub(r"\D", "", str(value or ""))


def normalize_title_case(value: str | None) -> str | None:
    text = normalize_whitespace(value)
    if not text:
        return None

    words = text.split(" ")
    out: list[str] = []
    for i, raw_word in enumerate(words):
        upper_raw = raw_word.upper()
        if upper_raw in TITLECASE_UPPER_WORDS:
            out.append(upper_raw)
            continue
        if i > 0 and upper_raw.lower() in TITLECASE_LOWER_WORDS:
            out.append(upper_raw.lower())
            continue
        out.append(upper_raw[:1] + upper_raw[1:].lower())
    return " ".join(out)


def normalize_municipio(value: str | None) -> str | None:
    text = normalize_whitespace(value)
    if not text:
        return None
    normalized = strip_accents(text).lower()
    normalized = re.sub(r"\s*-\s*", " - ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if normalized in GO_MUNICIPIOS_CANONICAL:
        return GO_MUNICIPIOS_CANONICAL[normalized]
    return normalized


def normalize_email(value: str | None) -> str | None:
    text = normalize_whitespace(value)
    if not text or "@" not in text:
        return None
    return text


def extract_primary_phone_digits(value: str | None) -> str | None:
    text = str(value or "")
    candidates = re.findall(r"\d+", text)
    if not candidates:
        return None
    merged = "".join(candidates)
    for start in range(0, len(merged)):
        for length in (11, 10):
            block = merged[start : start + length]
            if len(block) == length:
                return block
    return None


def _status_key(value: str) -> str:
    normalized = normalize_whitespace(value)
    normalized = strip_accents(normalized).lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    return normalized.strip("_")


def build_status_accept_map(
    canonical_to_label: dict[str, str],
    aliases: dict[str, str] | None = None,
) -> dict[str, str]:
    accept_map: dict[str, str] = {}
    for canonical, label in canonical_to_label.items():
        accept_map[_status_key(canonical)] = canonical
        accept_map[_status_key(label)] = canonical
    for raw, canonical in (aliases or {}).items():
        accept_map[_status_key(raw)] = canonical
    return accept_map


PROCESS_SITUACAO_ALIASES = {
    "em analise": "em_analise",
    "em_análise": "em_analise",
    "andamento": "em_andamento",
    "aguard docto": "aguardando_documento",
    "aguard documento": "aguardando_documento",
    "aguard vistoria": "aguardando_vistoria",
    "aguard pagto": "aguardando_pagamento",
    "aguard pagamento": "aguardando_pagamento",
    "aguard regularizacao": "aguardando_regularizacao",
    "aguard regularização": "aguardando_regularizacao",
    "aguard liberacao": "aguardando_liberacao",
    "aguard liberação": "aguardando_liberacao",
    "notificação": "notificacao",
    "concluído": "concluido",
}

PROCESS_SITUACAO_ACCEPT_MAP = build_status_accept_map(
    PROCESS_SITUACAO_LABELS,
    aliases=PROCESS_SITUACAO_ALIASES,
)

GENERIC_STATUS_ALIASES = {
    "nao": "nao_possui",
    "não": "nao_possui",
    "nao possui": "nao_possui",
    "não possui": "nao_possui",
    "nao exigido": "nao_exigido",
    "não exigido": "nao_exigido",
    "nao se aplica": "nao_exigido",
    "não se aplica": "nao_exigido",
    "dispensado": "nao_exigido",
    "dispensa": "nao_exigido",
    "possui definitiva": "definitivo",
    "possui_definitiva": "definitivo",
    "ir na visa": "ir_na_visa",
    "aguard_docto": "aguardando_documento",
    "aguard docto": "aguardando_documento",
    "aguard_documento": "aguardando_documento",
    "aguard_vistoria": "aguardando_vistoria",
    "aguard_pagto": "aguardando_pagamento",
    "aguard_pagamento": "aguardando_pagamento",
    "aguard_regularizacao": "aguardando_regularizacao",
    "aguard_liberacao": "aguardando_liberacao",
    "em analise": "em_analise",
    "notificação": "notificacao",
    "em aberto": "em_aberto",
    "emaberto": "em_aberto",
    "sem debitos": "sem_debitos",
    "sem débitos": "sem_debitos",
    "possui debito": "possui_debito",
    "possui débito": "possui_debito",
    "nao pago": "nao_pago",
    "não pago": "nao_pago",
}

GENERIC_STATUS_ACCEPT_MAP = build_status_accept_map(
    GENERIC_STATUS_LABELS,
    aliases=GENERIC_STATUS_ALIASES,
)


def normalize_status(
    value: str | None,
    accept_map: dict[str, str],
    *,
    strict: bool = True,
) -> str | None:
    text = normalize_whitespace(value)
    if not text:
        return None
    key = _status_key(text)
    canonical = accept_map.get(key)
    if canonical:
        return canonical
    if strict:
        raise ValueError("status value is not allowed")
    return key


def normalize_process_situacao(value: str | None, *, strict: bool = True) -> str | None:
    return normalize_status(
        value,
        PROCESS_SITUACAO_ACCEPT_MAP,
        strict=strict,
    )


def normalize_process_type(value: str | None) -> str | None:
    text = normalize_whitespace(value)
    if not text:
        return None
    key = strip_accents(text).upper()
    key = re.sub(r"[^A-Z0-9]+", "_", key).strip("_")
    if not key:
        return None
    return PROCESS_TYPE_ALIASES.get(key, key)


def normalize_generic_status(value: str | None, *, strict: bool = False) -> str | None:
    return normalize_status(
        value,
        GENERIC_STATUS_ACCEPT_MAP,
        strict=strict,
    )


def normalize_date_br(value: str | None, *, strict: bool = True) -> str | None:
    text = normalize_whitespace(value)
    if not text:
        return None

    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:$|T)", text)
    if iso_match:
        y, m, d = map(int, iso_match.groups())
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            if strict:
                raise ValueError("invalid date")
            return None

    br_match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", text)
    if br_match:
        d, m, y = map(int, br_match.groups())
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            if strict:
                raise ValueError("invalid date")
            return None

    if strict:
        raise ValueError("date must be in dd/mm/aaaa or yyyy-mm-dd format")
    return None
