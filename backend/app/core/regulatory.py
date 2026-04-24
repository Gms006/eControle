from __future__ import annotations

ALVARA_FUNCIONAMENTO_KIND_VALUES = (
    "DEFINITIVO",
    "CONDICIONADO",
    "PROVISORIO",
    "PENDENTE_REVISAO",
)

SANITARY_COMPLEXITY_VALUES = (
    "BAIXA",
    "MEDIA",
    "ALTA",
    "NAO_APLICAVEL",
    "PENDENTE_REVISAO",
)

ADDRESS_USAGE_TYPE_VALUES = (
    "FISCAL",
    "ADMINISTRATIVO",
    "OPERACIONAL",
    "MISTO",
    "PENDENTE_REVISAO",
)

ADDRESS_LOCATION_TYPE_VALUES = (
    "ESCRITORIO_CONTABIL",
    "ENDERECO_PROPRIO",
    "ENDERECO_TERCEIRO",
    "PENDENTE_REVISAO",
)

DEFAULT_ALVARA_FUNCIONAMENTO_KIND = "PENDENTE_REVISAO"
DEFAULT_SANITARY_COMPLEXITY = "PENDENTE_REVISAO"
DEFAULT_ADDRESS_USAGE_TYPE = "PENDENTE_REVISAO"
DEFAULT_ADDRESS_LOCATION_TYPE = "PENDENTE_REVISAO"


def _normalize_regulatory_enum(
    value: str | None,
    allowed: tuple[str, ...],
    *,
    default: str | None = None,
) -> str | None:
    if value is None:
        return default
    normalized = str(value or "").strip().upper()
    if not normalized:
        return default
    if normalized not in allowed:
        raise ValueError(f"invalid enum value: {value}")
    return normalized


def normalize_alvara_funcionamento_kind(value: str | None, *, default: str | None = None) -> str | None:
    return _normalize_regulatory_enum(
        value,
        ALVARA_FUNCIONAMENTO_KIND_VALUES,
        default=default,
    )


def normalize_sanitary_complexity(value: str | None, *, default: str | None = None) -> str | None:
    return _normalize_regulatory_enum(
        value,
        SANITARY_COMPLEXITY_VALUES,
        default=default,
    )


def normalize_address_usage_type(value: str | None, *, default: str | None = None) -> str | None:
    return _normalize_regulatory_enum(
        value,
        ADDRESS_USAGE_TYPE_VALUES,
        default=default,
    )


def normalize_address_location_type(value: str | None, *, default: str | None = None) -> str | None:
    return _normalize_regulatory_enum(
        value,
        ADDRESS_LOCATION_TYPE_VALUES,
        default=default,
    )


def infer_alvara_funcionamento_kind(
    *,
    source_document_kind: str | None = None,
    source_kind: str | None = None,
) -> str:
    document_kind = str(source_document_kind or "").strip().upper()
    raw_source_kind = str(source_kind or "").strip().lower()

    if document_kind == "ALVARA_FUNCIONAMENTO_DEFINITIVO":
        return "DEFINITIVO"
    if document_kind == "ALVARA_FUNCIONAMENTO_CONDICIONADO":
        return "CONDICIONADO"
    if document_kind == "ALVARA_FUNCIONAMENTO_PROVISORIO":
        return "PROVISORIO"
    if raw_source_kind == "definitivo":
        return "DEFINITIVO"
    return DEFAULT_ALVARA_FUNCIONAMENTO_KIND
