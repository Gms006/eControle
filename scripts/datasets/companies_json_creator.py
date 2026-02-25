# -*- coding: utf-8 -*-
"""
Conversor de planilha (Neto Contabilidade) para JSON v2
Compatível com: .xlsx / .xlsm / .csv / .tsv

Python 3.10+
Requer: pandas, openpyxl
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

try:
    import pandas as pd
except ImportError:
    print("Erro: instale as dependências com: pip install pandas openpyxl")
    sys.exit(1)


# ===== CONFIG =====
ORG_SLUG = "neto-contabilidade"
SOURCE_NAME = "LISTA EMPRESAS - NETO CONTABILIDADE 2025"
SOURCE_VERSION = "v1-to-v2-json"

# Regras de filtro já definidas
BLOCKED_PHONE = "6292982486"  # normalizado (só dígitos)
BLOCKED_EMAIL = "marco@netocontabilidade.com.br"


# ===== HELPERS =====
def to_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return str(v).strip()


def nullable(v: Any) -> Optional[str]:
    s = to_str(v)
    return s if s else None


def upper_nullable(v: Any) -> Optional[str]:
    s = to_str(v)
    return s.upper() if s else None


def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def normalize_phone_token(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def split_multi_values(raw_value: Any) -> list[str]:
    """
    Divide valores múltiplos em / ; |
    Ex.: 'a@x.com / b@y.com' -> ['a@x.com', 'b@y.com']
    """
    s = normalize_spaces(to_str(raw_value))
    if not s:
        return []

    parts = re.split(r"\s*/\s*|\s*;\s*|\s*\|\s*", s)
    return [p.strip() for p in parts if p and p.strip()]


def quote_join(values: list[str]) -> Optional[str]:
    """
    Retorna string no formato:
    "valor1", "valor2"
    """
    if not values:
        return None

    # remove duplicados preservando ordem
    seen = set()
    uniq = []
    for v in values:
        key = v.lower().strip()
        if key in seen:
            continue
        seen.add(key)
        # escapa aspas internas se houver
        v = v.replace('"', '\\"')
        uniq.append(f'"{v}"')

    return ", ".join(uniq) if uniq else None


def clean_phone(raw_phone: Any) -> Optional[str]:
    parts = split_multi_values(raw_phone)
    valid_parts = []

    for p in parts:
        if normalize_phone_token(p) == BLOCKED_PHONE:
            continue
        valid_parts.append(p)

    return quote_join(valid_parts)


def clean_email(raw_email: Any) -> Optional[str]:
    parts = split_multi_values(raw_email)
    valid_parts = []

    for p in parts:
        p_norm = p.lower().strip()
        if p_norm == BLOCKED_EMAIL:
            continue
        valid_parts.append(p_norm)

    return quote_join(valid_parts)


def normalize_cnpj(v: Any) -> Optional[str]:
    s = to_str(v)
    if not s:
        return None
    return s


def infer_municipio_uf(raw_municipio: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Exemplos:
    - 'Anápolis' -> ('ANÁPOLIS', 'GO')
    - 'Rio Branco - AC' -> ('RIO BRANCO', 'AC')
    - 'Cuiabá - MT' -> ('CUIABÁ', 'MT')
    - 'Coribe - BA' -> ('CORIBE', 'BA')
    """
    s = normalize_spaces(to_str(raw_municipio))
    if not s:
        return None, None

    m = re.match(r"^(.*?)(?:\s*-\s*([A-Z]{2}))$", s, flags=re.IGNORECASE)
    if m:
        cidade = normalize_spaces(m.group(1)).upper()
        uf = m.group(2).upper()
        return cidade, uf

    return s.upper(), "GO"


def parse_is_active(status_empresa: Any) -> bool:
    s = to_str(status_empresa).strip().lower()
    return s == "ativa"


def row_to_company(row: pd.Series, idx: int) -> Optional[Dict[str, Any]]:
    empresa = nullable(row.get("EMPRESA"))
    cnpj = normalize_cnpj(row.get("CNPJ"))

    # Pula linha vazia/quebrada
    if not empresa and not cnpj:
        return None

    municipio, uf = infer_municipio_uf(row.get("MUNICÍPIO"))
    status_empresas = nullable(row.get("status_empresas"))

    raw_obj = {}
    for col in row.index:
        raw_obj[str(col)] = nullable(row.get(col))

    external_id_val = nullable(row.get("ID")) if "ID" in row.index else None
    if not external_id_val:
        external_id_val = str(idx)

    rec = {
        "external_id": external_id_val,

        "cnpj": cnpj,
        "razao_social": empresa,
        "empresa": empresa,
        "nome_fantasia": nullable(row.get("NOME FANTASIA")) if "NOME FANTASIA" in row.index else None,
        "municipio": municipio,
        "uf": uf,
        "is_active": parse_is_active(status_empresas),

        "porte": nullable(row.get("PORTE")),
        "status_empresa": upper_nullable(status_empresas),
        "categoria": nullable(row.get("CATEGORIA")),
        "inscricao_estadual": nullable(row.get("INSCRIÇÃO ESTADUAL")),
        "inscricao_municipal": nullable(row.get("INSCRIÇÃO MUNICIPAL")),
        "situacao": nullable(row.get("SITUAÇÃO")),
        "debito_prefeitura": nullable(row.get("DÉBITO PREFEITURA")),
        "certificado_digital": nullable(row.get("CERTIFICADO DIGITAL")),
        "observacoes": nullable(row.get("OBS")),
        "proprietario_principal": nullable(row.get("PROPRIETÁRIO PRINCIPAL")),
        "cpf": nullable(row.get("CPF")),
        "telefone": clean_phone(row.get("TELEFONE")),
        "email": clean_email(row.get("E-MAIL")),
        "responsavel_fiscal": nullable(row.get("RESPONSÁVEL FISCAL")),

        "raw": raw_obj
    }

    return rec


def load_table(input_path: Path) -> pd.DataFrame:
    suffix = input_path.suffix.lower()

    if suffix in [".xlsx", ".xlsm", ".xls"]:
        return pd.read_excel(input_path, dtype=str)

    if suffix == ".csv":
        # tenta ; e depois ,
        try:
            return pd.read_csv(input_path, dtype=str, sep=";")
        except Exception:
            return pd.read_csv(input_path, dtype=str, sep=",")

    if suffix in [".tsv", ".txt"]:
        return pd.read_csv(input_path, dtype=str, sep="\t")

    raise ValueError(f"Formato não suportado: {suffix}")


def convert(input_file: str, output_file: str) -> None:
    path = Path(input_file)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    df = load_table(path)
    df.columns = [normalize_spaces(str(c)) for c in df.columns]

    temp_companies = []
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        rec = row_to_company(row, i)
        if rec is None:
            continue
        temp_companies.append(rec)

    # ===== DEDUPLICAÇÃO POR CNPJ =====
    # Regra: mantém a ÚLTIMA ocorrência da planilha (sobrescreve anteriores)
    dedup_by_cnpj: dict[str, Dict[str, Any]] = {}
    no_cnpj_rows: list[Dict[str, Any]] = []
    duplicated_cnpjs: list[str] = []

    for rec in temp_companies:
        cnpj = (rec.get("cnpj") or "").strip()
        if not cnpj:
            no_cnpj_rows.append(rec)
            continue

        if cnpj in dedup_by_cnpj:
            duplicated_cnpjs.append(cnpj)

        dedup_by_cnpj[cnpj] = rec  # sobrescreve, mantendo a última

    companies = list(dedup_by_cnpj.values()) + no_cnpj_rows

    payload = {
        "source": {
            "type": "spreadsheet_export",
            "name": SOURCE_NAME,
            "version": SOURCE_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        "org": {"slug": ORG_SLUG},
        "source_hash": None,
        "companies": companies
    }

    out_path = Path(output_file)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ JSON gerado com sucesso: {out_path}")
    print(f"📦 Linhas lidas (válidas): {len(temp_companies)}")
    print(f"🧹 Empresas após deduplicação por CNPJ: {len(companies)}")
    if duplicated_cnpjs:
        unicos = sorted(set(duplicated_cnpjs))
        print(f"🔁 CNPJs duplicados removidos ({len(unicos)} únicos):")
        for c in unicos:
            print(f"   - {c}")


if __name__ == "__main__":
    # Uso:
    # python converter_empresas_json.py "LISTA EMPRESAS - NETO CONTABILIDADE 2025.xlsx" "empresas_v2.json"
    if len(sys.argv) < 3:
        print("Uso: python converter_empresas_json.py <arquivo_entrada> <arquivo_saida.json>")
        sys.exit(1)

    convert(sys.argv[1], sys.argv[2])