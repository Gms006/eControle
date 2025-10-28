"""Transformation layer turning raw rows into canonical payloads."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Iterable, List, Optional

from .contracts import ConfigContract
from .normalizers import normalize_text, only_digits, parse_date_br, strip_accents
from .extract_xlsm import ROW_NUMBER_KEY


@dataclass(slots=True)
class NormalizedRow:
    table: str
    sheet: str
    row_number: int
    payload: Dict[str, Any]


PROCESS_TYPE_LABEL = {
    "diversos": "DIVERSOS",
    "funcionamento": "FUNCIONAMENTO",
    "bombeiros": "BOMBEIROS",
    "uso_solo": "USO_DO_SOLO",
    "sanitario": "SANITARIO",
    "ambiental": "AMBIENTAL",
}

LICENSE_COLUMNS = {
    "SANITARIA_STATUS": "SANITARIA",
    "FUNCIONAMENTO_STATUS": "FUNCIONAMENTO",
    "AMBIENTAL_STATUS": "AMBIENTAL",
    "USO_SOLO_STATUS": "USO_DO_SOLO",
    "CERCON_STATUS": "CERCON",
}

TAX_COLUMNS = {
    "TPI": "TPI",
    "FUNCIONAMENTO": "FUNCIONAMENTO",
    "PUBLICIDADE": "PUBLICIDADE",
    "SANITARIA": "SANITARIA",
    "LOCALIZACAO_INSTALACAO": "LOCALIZACAO_INSTALACAO",
    "AREA_PUBLICA": "AREA_PUBLICA",
}


class TransformError(ValueError):
    pass


def transform(raw_data: Dict[str, Any], contract: ConfigContract) -> Dict[str, List[NormalizedRow]]:
    batches: Dict[str, List[NormalizedRow]] = {
        "empresas": [],
        "licencas": [],
        "taxas": [],
        "processos": [],
        "certificados": [],
        "certificados_agendamentos": [],
    }

    empresas_rows = raw_data.get("empresas", [])
    batches["empresas"].extend(_transform_empresas(empresas_rows, contract))

    licenca_rows = raw_data.get("licencas", [])
    batches["licencas"].extend(_transform_licencas(licenca_rows, contract))

    taxa_rows = raw_data.get("taxas", [])
    batches["taxas"].extend(_transform_taxas(taxa_rows, contract))

    processos_section = raw_data.get("processos", {})
    batches["processos"].extend(_transform_processos(processos_section, contract))

    certificados_rows = raw_data.get("certificados", {})
    batches["certificados"].extend(
        _transform_generic_tables(
            certificados_rows, contract, "certificados", expected_keys=["certificados"]
        )
    )
    agendamento_rows = raw_data.get("certificados_agendamentos", {})
    batches["certificados_agendamentos"].extend(
        _transform_generic_tables(
            agendamento_rows,
            contract,
            "certificados_agendamentos",
            expected_keys=["agendamentos"],
        )
    )

    return batches


def apply(raw_data: Dict[str, Any], contract: ConfigContract) -> Dict[str, List[NormalizedRow]]:
    """Compatibility wrapper exposing :func:`transform` as ``apply``."""

    return transform(raw_data, contract)


def _transform_empresas(rows: Iterable[Dict[str, Any]], contract: ConfigContract) -> List[NormalizedRow]:
    alias_map = contract.alias_map("empresas")
    normalized_rows: List[NormalizedRow] = []
    sheet_name = contract.sheet_names.get("empresas", "EMPRESAS")
    for index, row in enumerate(rows, start=1):
        mapped = _remap_row(row, alias_map)
        cnpj = only_digits(mapped.get("CNPJ"))
        if not cnpj:
            continue
        empresa = normalize_text(mapped.get("EMPRESA"))
        municipio = normalize_text(mapped.get("MUNICIPIO"))
        porte = normalize_text(mapped.get("PORTE"))
        if not empresa:
            raise TransformError("Empresa ausente para documento %s" % cnpj)
        # Para PF/CAEPF, aceite município vazio (sua regra operacional)
        if not municipio and porte not in {"PF", "CAEPF"}:
            raise TransformError("Município ausente para documento %s" % cnpj)
        payload: Dict[str, Any] = {
            "empresa": empresa,
            "cnpj": cnpj,
            "municipio": municipio,
            "porte": normalize_text(mapped.get("PORTE")),
            "categoria": normalize_text(mapped.get("CATEGORIA")),
            "ie": normalize_text(mapped.get("IE")),
            "im": normalize_text(mapped.get("IM")),
            "situacao": normalize_text(mapped.get("SITUACAO")),
            "debito": normalize_text(mapped.get("DEBITO_PREFEITURA")),
            "certificado": normalize_text(mapped.get("CERTIFICADO_DIGITAL")),
            "obs": normalize_text(mapped.get("OBS")),
            "proprietario": normalize_text(mapped.get("PROPRIETARIO_PRINCIPAL")),
            "cpf": only_digits(mapped.get("CPF")),
            "telefone": normalize_text(mapped.get("TELEFONE")),
            "email": normalize_text(mapped.get("E_MAIL")),
            "responsavel": normalize_text(mapped.get("RESPONSAVEL_FISCAL")),
        }
        row_number = _row_number(row, index)
        normalized_rows.append(
            NormalizedRow(
                table="empresas",
                sheet=sheet_name,
                row_number=row_number,
                payload=payload,
            )
        )
    return normalized_rows


def _transform_licencas(rows: Iterable[Dict[str, Any]], contract: ConfigContract) -> List[NormalizedRow]:
    alias_map = contract.alias_map("licencas")
    normalized: List[NormalizedRow] = []
    sheet_name = contract.sheet_names.get("licencas", "LICENÇAS")
    for index, row in enumerate(rows, start=1):
        mapped = _remap_row(row, alias_map)
        cnpj = only_digits(mapped.get("CNPJ"))
        if not cnpj:
            continue
        row_number = _row_number(row, index)
        for source_col, tipo in LICENSE_COLUMNS.items():
            status = normalize_text(mapped.get(source_col))
            if not status:
                continue
            payload = {
                "empresa_cnpj": cnpj,
                "tipo": tipo,
                "status": status,
                "obs": normalize_text(mapped.get("OBS")),
            }
            normalized.append(
                NormalizedRow(
                    table="licencas",
                    sheet=sheet_name,
                    row_number=row_number,
                    payload=payload,
                )
            )
    return normalized


def _transform_taxas(rows: Iterable[Dict[str, Any]], contract: ConfigContract) -> List[NormalizedRow]:
    alias_map = contract.alias_map("taxas")
    normalized: List[NormalizedRow] = []
    sheet_name = contract.sheet_names.get("taxas", "TAXAS")
    for index, row in enumerate(rows, start=1):
        mapped = _remap_row(row, alias_map)
        cnpj = only_digits(mapped.get("CNPJ"))
        if not cnpj:
            continue
        row_number = _row_number(row, index)
        for source_col, tipo in TAX_COLUMNS.items():
            status = normalize_text(mapped.get(source_col))
            if not status:
                continue
            payload = {
                "empresa_cnpj": cnpj,
                "tipo": tipo,
                "status": status,
                "obs": normalize_text(mapped.get("STATUS_TAXAS")) or normalize_text(mapped.get("OBS")),
            }
            normalized.append(
                NormalizedRow(
                    table="taxas",
                    sheet=sheet_name,
                    row_number=row_number,
                    payload=payload,
                )
            )
    return normalized


def _transform_processos(section: Dict[str, Iterable[Dict[str, Any]]], contract: ConfigContract) -> List[NormalizedRow]:
    normalized: List[NormalizedRow] = []
    sheet_name = contract.sheet_names.get("processos", "PROCESSOS")
    for logical_table, rows in section.items():
        tipo = PROCESS_TYPE_LABEL.get(logical_table)
        if not tipo:
            continue
        alias_section = f"processos_{logical_table}"
        alias_map = contract.alias_map(alias_section)
        enum_situacao = contract.require_enum("situacao_processos")
        enum_operacao = contract.require_enum("operacoes_diversos")
        enum_orgao = contract.require_enum("orgaos_diversos")
        enum_alvara = contract.require_enum("alvaras_funcionamento")
        enum_servico = contract.require_enum("servicos_sanitarios")
        enum_notificacao = contract.require_enum("notificacoes_sanitarias")
        for index, row in enumerate(rows, start=1):
            mapped = _remap_row(row, alias_map)
            cnpj = only_digits(mapped.get("CNPJ"))
            if not cnpj:
                continue
                        # 1) usa SITUACAO; 2) senão STATUS_PADRAO; 3) default "PENDENTE"
            situacao_raw = (mapped.get("SITUACAO") or mapped.get("STATUS_PADRAO") or "PENDENTE")
            situacao = _normalize_enum(situacao_raw, enum_situacao, "situacao", tipo)
            # data_solicitacao pode ficar vazia (linhas placeholder são válidas)
            data_solicitacao = _safe_parse_date(mapped.get("DATA_SOLICITACAO"), "data_solicitacao", tipo)
            protocolo = normalize_text(mapped.get("PROTOCOLO"))
            status_padrao = normalize_text(mapped.get("STATUS_PADRAO"))
            payload: Dict[str, Any] = {
                "empresa_cnpj": cnpj,
                "tipo": tipo,
                "protocolo": protocolo,
                "data_solicitacao": data_solicitacao,
                "situacao": situacao,
                "status_padrao": status_padrao,
                "obs": normalize_text(mapped.get("OBS")),
            }
            if logical_table == "diversos":
                payload["operacao"] = _normalize_enum_optional(mapped.get("OPERACAO"), enum_operacao, "operacao", tipo)
                payload["orgao"] = _normalize_enum_optional(mapped.get("ORGAO"), enum_orgao, "orgao", tipo)
            if logical_table == "funcionamento":
                payload["alvara"] = _normalize_enum_optional(mapped.get("ALVARA"), enum_alvara, "alvara", tipo)
                payload["municipio"] = normalize_text(mapped.get("MUNICIPIO"))
            if logical_table == "bombeiros":
                payload["tpi"] = normalize_text(mapped.get("TPI"))
            if logical_table == "uso_solo":
                payload["inscricao_imobiliaria"] = normalize_text(mapped.get("INSCRICAO_IMOBILIARIA"))
            if logical_table == "sanitario":
                payload["servico"] = _normalize_enum_optional(mapped.get("SERVICO"), enum_servico, "servico", tipo)
                payload["taxa"] = normalize_text(mapped.get("TAXA"))
                payload["notificacao"] = _normalize_enum_optional(mapped.get("NOTIFICACAO"), enum_notificacao, "notificacao", tipo)
                payload["data_val"] = _safe_parse_date(mapped.get("DATA_VAL"), "data_val", tipo)
            row_number = _row_number(row, index)
            normalized.append(
                NormalizedRow(
                    table="processos",
                    sheet=sheet_name,
                    row_number=row_number,
                    payload=payload,
                )
            )
    return normalized


def _transform_generic_tables(
    tables: Dict[str, Iterable[Dict[str, Any]]],
    contract: ConfigContract,
    section: str,
    expected_keys: List[str],
) -> List[NormalizedRow]:
    normalized: List[NormalizedRow] = []
    for key in expected_keys:
        rows = tables.get(key) or []
        alias_section = f"{section}_{key}"
        if alias_section not in contract.column_aliases:
            continue
        alias_map = contract.alias_map(alias_section)
        sheet_name = contract.sheet_names.get(section, section.upper())
        for index, row in enumerate(rows, start=1):
            mapped = _remap_row(row, alias_map)
            row_number = _row_number(row, index)
            normalized.append(
                NormalizedRow(
                    table=section,
                    sheet=sheet_name,
                    row_number=row_number,
                    payload=mapped,
                )
            )
    return normalized


def _normalize_enum(value: Any | None, allowed: Iterable[str], field: str, tipo: str) -> str:
    normalized = _normalize_enum_optional(value, allowed, field, tipo)
    if normalized is None:
        raise TransformError(f"Valor obrigatório para {field} em {tipo}")
    return normalized


def _normalize_enum_optional(value: Any | None, allowed: Iterable[str], field: str, tipo: str) -> Optional[str]:
    # Placeholders aceitos como "vazio"
    PLACEHOLDERS = {"-", "–", "—", "*"}
    if value in (None, "") or (isinstance(value, str) and value.strip() in PLACEHOLDERS):
        return None
    target = normalize_text(value)
    if not target:
        return None
    target_key = strip_accents(target).casefold()
    for option in allowed:
        option_key = strip_accents(option).casefold()
        if option_key == target_key:
            return option
    raise TransformError(f"Valor inválido '{value}' para {field} em {tipo}")


def _safe_parse_date(value: Any | None, field: str, tipo: str) -> date | None:
    PLACEHOLDERS = {"-", "–", "—", "*"}
    if value in (None, "") or (isinstance(value, str) and value.strip() in PLACEHOLDERS):
        return None
    try:
        return parse_date_br(value)
    except ValueError as exc:
        raise TransformError(f"Data inválida em {field} ({tipo}): {value}") from exc


def _remap_row(row: Dict[str, Any], alias_map: Dict[str, str]) -> Dict[str, Any]:
    mapped: Dict[str, Any] = {}
    for key, value in row.items():
        if key == ROW_NUMBER_KEY:
            continue
        canonical = alias_map.get(_normalize_key(key))
        if canonical:
            mapped[canonical] = value
    return mapped


def _normalize_key(key: str) -> str:
    return strip_accents(str(key)).casefold().replace(" ", "").replace("_", "")


def _row_number(row: Dict[str, Any], default_index: int) -> int:
    value = row.get(ROW_NUMBER_KEY)
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return default_index + 1
