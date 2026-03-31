from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import hashlib
import re
import unicodedata

from app.schemas.company_licence import LICENCE_FIELDS


@dataclass(frozen=True)
class LicenceNameSpec:
    field: str
    label: str
    requires_expiry: bool


@dataclass(frozen=True)
class ParsedLicenceFilename:
    field: str
    extension: str
    expiry_date: date | None
    source_kind: str
    source_label: str


LICENCE_FIELD_LABELS: dict[str, str] = {
    "alvara_vig_sanitaria": "Alvará Vig Sanitária",
    "cercon": "Alvará Bombeiros",
    "alvara_funcionamento": "Alvará Funcionamento - Condicionado",
    "licenca_ambiental": "Licença Ambiental",
    "certidao_uso_solo": "Uso do Solo",
}

LICENCE_NAMING_SPECS: dict[str, LicenceNameSpec] = {
    "ALVARA_BOMBEIROS": LicenceNameSpec("cercon", "Alvará Bombeiros", True),
    "CERCON": LicenceNameSpec("cercon", "Alvará Bombeiros", True),
    "ALVARA_VIG_SANITARIA": LicenceNameSpec("alvara_vig_sanitaria", "Alvará Vig Sanitária", True),
    "ALVARA_SANITARIO": LicenceNameSpec("alvara_vig_sanitaria", "Alvará Vig Sanitária", True),
    "SANITARIA": LicenceNameSpec("alvara_vig_sanitaria", "Alvará Vig Sanitária", True),
    "ALVARA_FUNCIONAMENTO": LicenceNameSpec("alvara_funcionamento", "Alvará Funcionamento - Condicionado", True),
    "ALVARA_FUNCIONAMENTO_CONDICIONADO": LicenceNameSpec(
        "alvara_funcionamento", "Alvará Funcionamento - Condicionado", True
    ),
    "ALVARA_FUNCIONAMENTO_PROVISORIO": LicenceNameSpec(
        "alvara_funcionamento", "Alvará Funcionamento - Provisório", True
    ),
    "ALVARA_FUNCIONAMENTO_DEFINITIVO": LicenceNameSpec(
        "alvara_funcionamento", "Alvará Funcionamento", False
    ),
    "USO_DO_SOLO": LicenceNameSpec("certidao_uso_solo", "Uso do Solo", True),
    "CERTIDAO_USO_SOLO": LicenceNameSpec("certidao_uso_solo", "Uso do Solo", True),
    "LICENCA_AMBIENTAL": LicenceNameSpec("licenca_ambiental", "Licença Ambiental", True),
    "AMBIENTAL": LicenceNameSpec("licenca_ambiental", "Licença Ambiental", True),
    "DISPENSA_SANITARIA": LicenceNameSpec("alvara_vig_sanitaria", "Dispensa Sanitária", True),
    "DISPENSA_SANITARIA_DEFINITIVO": LicenceNameSpec("alvara_vig_sanitaria", "Dispensa Sanitária", False),
    "DISPENSA_AMBIENTAL": LicenceNameSpec("licenca_ambiental", "Dispensa Ambiental", True),
    "DISPENSA_AMBIENTAL_DEFINITIVO": LicenceNameSpec("licenca_ambiental", "Dispensa Ambiental", False),
}

LICENCE_TYPE_ALIASES: dict[str, str] = {
    "ALVARA_VIG_SANITARIA": "alvara_vig_sanitaria",
    "ALVARA_SANITARIO": "alvara_vig_sanitaria",
    "SANITARIA": "alvara_vig_sanitaria",
    "CERCON": "cercon",
    "ALVARA_FUNCIONAMENTO": "alvara_funcionamento",
    "FUNCIONAMENTO": "alvara_funcionamento",
    "LICENCA_AMBIENTAL": "licenca_ambiental",
    "AMBIENTAL": "licenca_ambiental",
    "CERTIDAO_USO_SOLO": "certidao_uso_solo",
    "USO_SOLO": "certidao_uso_solo",
}

SUPPORTED_EXTENSIONS = {"pdf", "jpg", "png"}
STANDARD_NAME_VAL_RE = re.compile(
    r"^(?P<label>.+?)\s+-\s+Val\s+(?P<date>\d{2}\.\d{2}\.\d{4})\.(?P<ext>pdf|jpg|png)$",
    re.IGNORECASE,
)
STANDARD_NAME_DEFINITIVO_RE = re.compile(
    r"^(?P<label>.+?)\s+-\s+Definitivo\.(?P<ext>pdf|jpg|png)$",
    re.IGNORECASE,
)


def _label_specs_map() -> dict[str, LicenceNameSpec]:
    specs = {key: value for key, value in LICENCE_NAMING_SPECS.items()}
    specs["ALVARA_FUNCIONAMENTO_COND"] = LICENCE_NAMING_SPECS["ALVARA_FUNCIONAMENTO_CONDICIONADO"]
    specs["ALVARA_FUNCIONAMENTO_PROVISORIO_VAL"] = LICENCE_NAMING_SPECS["ALVARA_FUNCIONAMENTO_PROVISORIO"]
    return specs


def _normalize_key(value: str | None) -> str:
    text = str(value or "").strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).upper()
    return text.strip("_")


def resolve_licence_type(value: str | None) -> str | None:
    key = _normalize_key(value)
    if not key:
        return None
    spec = _label_specs_map().get(key)
    if spec:
        return spec.field
    if key in LICENCE_TYPE_ALIASES:
        return LICENCE_TYPE_ALIASES[key]
    candidate = key.lower()
    if candidate in LICENCE_FIELDS:
        return candidate
    return None


def label_for_licence_type(field: str) -> str:
    return LICENCE_FIELD_LABELS.get(field, field)


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def resolve_licence_name_spec(value: str | None) -> LicenceNameSpec | None:
    key = _normalize_key(value)
    if not key:
        return None
    spec = _label_specs_map().get(key)
    if spec:
        return spec
    canonical = resolve_licence_type(value)
    if not canonical:
        return None
    return LicenceNameSpec(
        field=canonical,
        label=label_for_licence_type(canonical),
        requires_expiry=True,
    )


def format_standard_filename(spec: LicenceNameSpec, expiry_date: date | None, extension: str) -> str:
    label = spec.label
    ext = extension.lower().strip(".")
    if spec.requires_expiry:
        if not expiry_date:
            raise ValueError("Expiry date is required for this licence type")
        return f"{label} - Val {expiry_date.strftime('%d.%m.%Y')}.{ext}"
    return f"{label} - Definitivo.{ext}"


def parse_standard_filename(filename: str) -> ParsedLicenceFilename | None:
    text = str(filename or "").strip()
    match_val = STANDARD_NAME_VAL_RE.match(text)
    if match_val:
        spec = resolve_licence_name_spec(match_val.group("label"))
        if not spec:
            return None
        try:
            expiry_date = datetime.strptime(match_val.group("date"), "%d.%m.%Y").date()
        except ValueError:
            return None
        return ParsedLicenceFilename(
            field=spec.field,
            extension=match_val.group("ext").lower(),
            expiry_date=expiry_date,
            source_kind="dated",
            source_label=match_val.group("label").strip(),
        )

    match_definitivo = STANDARD_NAME_DEFINITIVO_RE.match(text)
    if not match_definitivo:
        return None
    spec = resolve_licence_name_spec(match_definitivo.group("label"))
    if not spec:
        return None
    return ParsedLicenceFilename(
        field=spec.field,
        extension=match_definitivo.group("ext").lower(),
        expiry_date=None,
        source_kind="definitivo",
        source_label=match_definitivo.group("label").strip(),
    )


def is_safe_fs_dirname(dirname: str | None) -> bool:
    value = str(dirname or "").strip()
    if not value:
        return False
    if value in {".", ".."}:
        return False
    if "\x00" in value:
        return False
    if value.startswith("/") or value.startswith("\\"):
        return False
    if ".." in value:
        return False
    if ":" in value or "\\" in value or "/" in value:
        return False
    return True


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
