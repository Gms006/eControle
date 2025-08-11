"""
Validações e normalizações do projeto Maria Clara.
- CNPJ: limpeza, máscara e verificação de dígitos
- Datas: parse para ISO (YYYY-MM-DD) a partir de formatos comuns BR
- Enums: mapa tolerante a variações (maiúsculas/acentos/sinônimos)
- Taxas: parsing de parcelamento ("0/3") e anos em aberto ("2024 até 2025 em aberto")

Uso típico:
    from core.enums import (
        LicencaSituacao, TPIStatus, TaxaSituacao,
        ProcessoSituacao,
    )
    s = map_enum(TaxaSituacao, "pago")  # -> TaxaSituacao.PAGO
    to_iso("31/12/2025")                 # -> "2025-12-31"
    is_valid_cnpj("12.345.678/0001-90")
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Optional, Type, TypeVar

try:  # imports opcionais para tipagem/uso; o arquivo funciona sem eles em runtime
    from core.enums import (
        LicencaSituacao,
        TPIStatus,
        TaxaSituacao,
        ProcessoSituacao,
    )
except Exception:  # pragma: no cover - fallback para edição isolada
    class _StrEnum(str):
        pass
    class LicencaSituacao(_StrEnum): pass
    class TPIStatus(_StrEnum): pass
    class TaxaSituacao(_StrEnum): pass
    class ProcessoSituacao(_StrEnum): pass


# ==========================================================
# Erros e utilitários
# ==========================================================
class ValidationError(Exception):
    """Erro de validação de dados de entrada."""


def only_digits(s: Optional[str]) -> str:
    return re.sub(r"\D", "", (s or ""))


def strip_accents(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_token(s: str) -> str:
    s = strip_accents(s or "").lower()
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"[\W_]+", "", s)  # remove pontuação para igualar "em-aberto" ~ "em aberto"
    return s


# ==========================================================
# CNPJ
# ==========================================================
CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
CNPJ_WEIGHTS_2 = [6] + CNPJ_WEIGHTS_1


def is_valid_cnpj(value: Optional[str]) -> bool:
    digits = only_digits(value)
    if len(digits) != 14 or len(set(digits)) == 1:
        return False
    base = [int(d) for d in digits[:12]]
    d1 = _cnpj_check_digit(base, CNPJ_WEIGHTS_1)
    d2 = _cnpj_check_digit(base + [d1], CNPJ_WEIGHTS_2)
    return digits.endswith(f"{d1}{d2}")


def _cnpj_check_digit(nums: list[int], weights: list[int]) -> int:
    s = sum(n * w for n, w in zip(nums, weights))
    r = s % 11
    return 0 if r < 2 else 11 - r


def mask_cnpj(value: str) -> str:
    d = only_digits(value)
    if len(d) != 14:
        raise ValidationError("CNPJ deve ter 14 dígitos")
    return f"{d[0:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:14]}"


# ==========================================================
# Datas
# ==========================================================
_DATE_PATTERNS = (
    (r"^(\d{4})[-/](\d{2})[-/](\d{2})$", "%Y-%m-%d"),  # 2025-08-11 ou 2025/08/11
    (r"^(\d{2})[-/](\d{2})[-/](\d{4})$", "%d/%m/%Y"),  # 11/08/2025 ou 11-08-2025
    (r"^(\d{2})[.](\d{2})[.](\d{4})$", "%d.%m.%Y"),   # 11.08.2025
)


def to_iso(date_str: Optional[str]) -> Optional[str]:
    """Converte datas comuns (BR) para ISO YYYY-MM-DD. Retorna None para vazio.
    Lança ValidationError se formato não reconhecido.
    """
    if date_str is None:
        return None
    raw = str(date_str).strip()
    if raw == "":
        return None
    # tenta yyyy-mm-dd direto
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date().isoformat()
    except Exception:
        pass
    for pat, fmt in _DATE_PATTERNS:
        if re.match(pat, raw):
            # normaliza separadores conforme fmt esperado
            norm = raw.replace(".", "/").replace("-", "/") if "%d/%m/%Y" in fmt else raw
            dt = datetime.strptime(norm, fmt)
            return dt.date().isoformat()
    raise ValidationError(f"Data inválida/indeterminada: '{date_str}'")


# ==========================================================
# Taxas: parcelamento e anos em aberto
# ==========================================================
@dataclass
class Parcelamento:
    pagas: int
    total: int


@dataclass
class AnosEmAberto:
    ano_inicial: int
    ano_final: int


_PARCEL_RE = re.compile(r"^(?P<p>\d+)\s*/\s*(?P<t>\d+)$")
_ANOS_ABERTOS_RE = re.compile(
    r"^(?P<a1>\d{4})(?:\s*ate\s*(?P<a2>\d{4}))?\s+em\s+aberto$",
    flags=re.I,
)


def parse_parcelamento(raw: Optional[str]) -> Optional[Parcelamento]:
    if not raw:
        return None
    m = _PARCEL_RE.fullmatch(str(raw).strip())
    if not m:
        return None
    p, t = int(m.group("p")), int(m.group("t"))
    if t <= 0 or p < 0 or p > t:
        raise ValidationError("Parcelamento inconsistente")
    return Parcelamento(pagas=p, total=t)


def parse_anos_em_aberto(raw: Optional[str]) -> Optional[AnosEmAberto]:
    if not raw:
        return None
    s = strip_accents(str(raw))
    s = re.sub(r"\s+", " ", s).strip()
    m = _ANOS_ABERTOS_RE.fullmatch(s)
    if not m:
        return None
    a1 = int(m.group("a1"))
    a2 = int(m.group("a2") or m.group("a1"))
    if a2 < a1:
        raise ValidationError("Intervalo de anos inválido")
    return AnosEmAberto(ano_inicial=a1, ano_final=a2)


# ==========================================================
# Map de enums tolerante (acentos/maiúsculas/sinônimos)
# ==========================================================
E = TypeVar("E")

# aliases normalizados por Enum (chave = token normalizado, valor = *valor* alvo do Enum)
ALIAS_MAP: dict[str, dict[str, str]] = {
    "TaxaSituacao": {
        "pago": "Pago",
        "quitado": "Pago",
        "emaberto": "Em aberto",
        "aberto": "Em aberto",
        "aberta": "Em aberto",
        "parcelado": "Parcelado",
        "parcelada": "Parcelado",
        "naoseaplica": "*",
        "isento": "*",
        "*": "*",
    },
    "LicencaSituacao": {
        "possui": "Possui",
        "valida": "Possui",
        "vencido": "Vencido",
        "vencida": "Vencido",
        "dispensa": "Dispensa",
        "naoseaplica": "*",
        "*": "*",
        "nao": "NÃO",
        "não": "NÃO",
    },
    "TPIStatus": {
        "": "-",
        "-": "-",
        "—": "-",
        "emitir": "EMITIR",
        "paraemitir": "EMITIR",
        "enviado": "ENVIADO",
        "protocolado": "ENVIADO",
        "pago": "PAGO",
        "quitado": "PAGO",
    },
    "ProcessoSituacao": {
        "aguarddocto": "AGUARD DOCTO",
        "aguardpagto": "AGUARD PAGTO",
        "emanalyse": "EM ANÁLISE",
        "emanalise": "EM ANÁLISE",
        "pendente": "PENDENTE",
        "indeferido": "INDEFERIDO",
        "concluido": "CONCLUÍDO",
        "licenciado": "LICENCIADO",
        "notificacao": "NOTIFICAÇÃO",
        "aguardvistoria": "AGUARD VISTORIA",
        "aguardregularizacao": "AGUARD REGULARIZAÇÃO",
        "aguardliberacao": "AGUARD LIBERAÇÃO",
        "irnavisa": "IR NA VISA",
    },
}


def map_enum(
    enum_cls: Type[E],
    raw: Any,
    aliases: Optional[Mapping[str, str]] = None,
    default: Optional[E] = None,
    raise_on_fail: bool = False,
) -> Optional[E]:
    """Converte `raw` para um membro do Enum, aceitando variações de acento/caixa.
    - Tenta casar com o **valor** do Enum (preferência) e com o **name** do membro.
    - `aliases` permite atalhos extras (mapeados para o **valor** do Enum).
    - `default` é retornado quando não reconhecido, a menos que `raise_on_fail=True`.
    """
    if raw is None:
        return default
    text = str(raw).strip()
    if text == "":
        return default

    # 1) match direto por valor (case sensitive)
    for member in enum_cls:  # type: ignore[attr-defined]
        if text == str(member.value):  # type: ignore[union-attr]
            return member

    # 2) match por valor normalizado
    norm_text = normalize_token(text)
    norm_to_value = {normalize_token(str(m.value)): m for m in enum_cls}  # type: ignore[attr-defined]
    if norm_text in norm_to_value:
        return norm_to_value[norm_text]

    # 3) match por NAME do Enum
    name_to_member = {normalize_token(m.name): m for m in enum_cls}  # type: ignore[attr-defined]
    if norm_text in name_to_member:
        return name_to_member[norm_text]

    # 4) aliases específicos para esse Enum
    aliases_final: dict[str, str] = {}
    enum_key = getattr(enum_cls, "__name__", "")
    aliases_final.update(ALIAS_MAP.get(enum_key, {}))
    if aliases:
        aliases_final.update({normalize_token(k): v for k, v in aliases.items()})

    if norm_text in aliases_final:
        target_value = aliases_final[norm_text]
        for member in enum_cls:  # type: ignore[attr-defined]
            if str(member.value) == target_value:  # type: ignore[union-attr]
                return member

    if raise_on_fail:
        raise ValidationError(f"Valor não reconhecido para {enum_key or enum_cls}: {raw!r}")
    return default


# ==========================================================
# Checklists / obrigatórios (estrutura simples)
# ==========================================================

def faltantes_obrigatorios(obrigatorios: set[str], recebidos: Mapping[str, Any]) -> list[str]:
    """Retorna a lista de obrigatórios que NÃO foram atendidos (valor vazio/False/None)."""
    missing: list[str] = []
    for key in sorted(obrigatorios):
        val = recebidos.get(key)
        if val in (None, "", False):
            missing.append(key)
    return missing


# ==========================================================
# Validadores compostos
# ==========================================================

def validar_empresa_cnpj(cnpj: str) -> str:
    """Valida e retorna o CNPJ mascarado. Lança ValidationError se inválido."""
    if not is_valid_cnpj(cnpj):
        raise ValidationError("CNPJ inválido")
    return mask_cnpj(cnpj)


def validar_taxa_campos(status: Any, parcelamento_raw: Optional[str], anos_raw: Optional[str]) -> tuple[Optional[Parcelamento], Optional[AnosEmAberto]]:
    """Regras de coerência entre status e campos auxiliares das Taxas."""
    try:
        from core.enums import TaxaSituacao  # import local para evitar ciclos em testes
    except Exception:  # pragma: no cover
        TaxaSituacao = None  # type: ignore

    parc = parse_parcelamento(parcelamento_raw)
    anos = parse_anos_em_aberto(anos_raw)

    if TaxaSituacao and status == TaxaSituacao.PARCELADO and not parc:
        raise ValidationError("Status 'Parcelado' requer 'parcelas_pagas/parcelas_total'.")
    if TaxaSituacao and status == TaxaSituacao.ANOS_ANTERIORES_ABERTO and not anos:
        raise ValidationError("Status 'Anos anteriores em aberto' requer anos inicial/final.")
    return parc, anos
