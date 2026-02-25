# -*- coding: utf-8 -*-
"""
Conversor de LICENÇAS (TXT/CSV exportado da planilha) -> JSON v2
Modelo: company_licences (root key "licences")

Funcionalidades:
- Auto-detecta delimitador (tab, vírgula, ;, |)
- Suporta campos com aspas (CSV seguro)
- Normaliza CNPJ/CPF (mantém apenas dígitos)
- Deduplica por CNPJ (mantém a ÚLTIMA ocorrência)
- Compara com empresas_v2.json e gera relatórios:
    * CNPJs de licenças que não existem em companies
    * CNPJs de companies faltando em licenças
    * Razão social divergente por CNPJ
- Pode adicionar automaticamente empresas faltantes com base em regras manuais
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple


# =========================
# CONFIG PADRÃO (ajuste se quiser)
# =========================
DEFAULT_INPUT = r"G:\PMA\SCRIPTS\eControle\scripts\ingest_licencas.txt"
DEFAULT_COMPANIES_JSON = r"G:\PMA\SCRIPTS\eControle\scripts\empresas_v2.json"
DEFAULT_OUTPUT = r"G:\PMA\SCRIPTS\eControle\scripts\company_licences_v2.json"
DEFAULT_SOURCE_NAME = "LICENCAS - NETO CONTABILIDADE 2025"
DEFAULT_ORG_SLUG = "neto-contabilidade"


# =========================
# REGRAS EXTRAS (as 12 que você passou)
# =========================
# Observação:
# - Campos não citados como "Sujeito" ficam "*" por padrão
# - Quando a regra é "NÃO", marcamos os 5 campos como "NÃO"
EXTRA_COMPANY_LICENCE_RULES: Dict[str, Dict[str, Any]] = {
    # Funcionamento, CERCON e Uso do Solo
    "64713920000130": {
        "empresa": "Agropecuaria Fazenda Nossa Senhora Da Penha LTDA",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },
    "07044715000195": {
        "empresa": "Auto Mecanica Enzo Marques LTDA",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },
    "64785870000104": {
        "empresa": "BM Solucoes Autonomas LTDA",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },
    "63309522000190": {
        "empresa": "Premier FX LTDA",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },

    # Funcionamento, CERCON, Sanitário e Uso do Solo
    "61544100000173": {
        "empresa": "Emporio Rota do Lago LTDA",
        "alvara_vig_sanitaria": "Sujeito",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },
    "63379261000184": {
        "empresa": "JS Medicamentos LTDA",
        "alvara_vig_sanitaria": "Sujeito",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },
    "63839497000156": {
        "empresa": "Supermercado Bessa LTDA",
        "alvara_vig_sanitaria": "Sujeito",
        "cercon": "Sujeito",
        "alvara_funcionamento": "Sujeito",
        "certidao_uso_solo": "Sujeito",
    },

    # NÃO (todos os campos de licença)
    "63325683000177": {"empresa": "Avlis LTDA", "ALL": "NÃO"},
    "19449535000172": {"empresa": "Centro Comercial Mariah LTDA", "ALL": "NÃO"},
    "63501671000156": {"empresa": "GJX Comercio e Importacao LTDA", "ALL": "NÃO"},
    "64034264000149": {"empresa": "Maxima Participacoes e Investimentos LTDA", "ALL": "NÃO"},
    "64015418000155": {"empresa": "RLM Participacoes e Investimentos LTDA", "ALL": "NÃO"},
}


# =========================
# UTILITÁRIOS
# =========================
def strip_accents(text: str) -> str:
    if text is None:
        return ""
    return "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    )


def clean_spaces(text: str) -> str:
    if text is None:
        return ""
    # remove espaços duplicados e invisíveis comuns
    text = str(text).replace("\ufeff", "").replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def norm_cnpj(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def header_key(text: str) -> str:
    t = clean_spaces(text)
    t = strip_accents(t).upper()
    t = re.sub(r"[^A-Z0-9]+", " ", t).strip()
    return t


def status_value(text: str) -> str:
    # Preserva conteúdo, só limpa espaços
    return clean_spaces(text)


def municipio_value(text: str) -> str:
    return clean_spaces(text).upper()


def name_for_compare(text: str) -> str:
    t = strip_accents(clean_spaces(text)).upper()
    # remove pontuação, mantém letras/números
    t = re.sub(r"[^A-Z0-9]+", "", t)
    return t


def detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        return dialect.delimiter
    except Exception:
        # fallback
        if "\t" in sample:
            return "\t"
        if ";" in sample:
            return ";"
        if "|" in sample:
            return "|"
        return ","


def load_companies(companies_path: Path) -> Dict[str, Dict[str, Any]]:
    with companies_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    companies = data.get("companies", [])
    by_cnpj = {}
    for row in companies:
        cnpj = clean_spaces(row.get("cnpj", ""))
        if cnpj:
            by_cnpj[cnpj] = row
    return by_cnpj


# =========================
# LEITURA E MAPEAMENTO
# =========================
HEADER_ALIASES = {
    "EMPRESA": "EMPRESA",
    "RAZAO SOCIAL": "EMPRESA",
    "RAZAO": "EMPRESA",

    "CNPJ": "CNPJ",
    "CPF CNPJ": "CNPJ",

    "MUNICIPIO": "MUNICÍPIO",
    "MUNICIPIO CIDADE": "MUNICÍPIO",
    "CIDADE": "MUNICÍPIO",

    "ALVARA VIG SANITARIA": "ALVARÁ VIG SANITÁRIA",
    "ALVARA SANITARIO": "ALVARÁ VIG SANITÁRIA",
    "ALVARA VIGILANCIA SANITARIA": "ALVARÁ VIG SANITÁRIA",

    "CERCON": "CERCON",

    "ALVARA FUNCIONAMENTO": "ALVARÁ FUNCIONAMENTO",

    "LICENCA AMBIENTAL": "LICENÇA AMBIENTAL",
    "LICENCA AMB": "LICENÇA AMBIENTAL",

    "CERTIDAO USO SOLO": "CERTIDÃO USO SOLO",
    "USO DO SOLO": "CERTIDÃO USO SOLO",
}

REQUIRED_HEADERS = [
    "EMPRESA",
    "CNPJ",
    "MUNICÍPIO",
    "ALVARÁ VIG SANITÁRIA",
    "CERCON",
    "ALVARÁ FUNCIONAMENTO",
    "LICENÇA AMBIENTAL",
    "CERTIDÃO USO SOLO",
]


def remap_headers(fieldnames: Sequence[str]) -> Dict[str, str]:
    mapped = {}
    for raw in fieldnames:
        k = header_key(raw)
        canon = HEADER_ALIASES.get(k)
        if canon:
            mapped[raw] = canon
    return mapped


def parse_input_rows(input_path: Path) -> List[Dict[str, str]]:
    text = input_path.read_text(encoding="utf-8-sig", errors="replace")
    sample = "\n".join(text.splitlines()[:5])
    delimiter = detect_delimiter(sample)

    rows: List[Dict[str, str]] = []
    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("Não foi possível identificar cabeçalhos no arquivo de entrada.")

        header_map = remap_headers(reader.fieldnames)

        # valida se os cabeçalhos obrigatórios estão mapeados
        mapped_values = set(header_map.values())
        missing_headers = [h for h in REQUIRED_HEADERS if h not in mapped_values]
        if missing_headers:
            raise ValueError(
                f"Cabeçalhos obrigatórios não encontrados/mapeados: {missing_headers}\n"
                f"Encontrados: {reader.fieldnames}\n"
                f"Dica: exporte em CSV/TXT com cabeçalhos e use aspas nos campos."
            )

        for row in reader:
            out = {h: "" for h in REQUIRED_HEADERS}
            for raw_col, value in row.items():
                canon = header_map.get(raw_col)
                if canon:
                    out[canon] = clean_spaces(value)
            # ignora linhas totalmente vazias
            if not any(out.values()):
                continue
            rows.append(out)

    return rows


# =========================
# CONVERSÃO
# =========================
def row_to_licence_obj(row: Dict[str, str]) -> Dict[str, Any]:
    cnpj_digits = norm_cnpj(row.get("CNPJ", ""))
    return {
        "cnpj": cnpj_digits,
        "municipio": municipio_value(row.get("MUNICÍPIO", "")),
        "alvara_vig_sanitaria": status_value(row.get("ALVARÁ VIG SANITÁRIA", "")) or "*",
        "cercon": status_value(row.get("CERCON", "")) or "*",
        "alvara_funcionamento": status_value(row.get("ALVARÁ FUNCIONAMENTO", "")) or "*",
        "licenca_ambiental": status_value(row.get("LICENÇA AMBIENTAL", "")) or "*",
        "certidao_uso_solo": status_value(row.get("CERTIDÃO USO SOLO", "")) or "*",
        "raw": {
            "EMPRESA": clean_spaces(row.get("EMPRESA", "")),
            "CNPJ": clean_spaces(row.get("CNPJ", "")),
            "MUNICÍPIO": clean_spaces(row.get("MUNICÍPIO", "")),
            "ALVARÁ VIG SANITÁRIA": clean_spaces(row.get("ALVARÁ VIG SANITÁRIA", "")),
            "CERCON": clean_spaces(row.get("CERCON", "")),
            "ALVARÁ FUNCIONAMENTO": clean_spaces(row.get("ALVARÁ FUNCIONAMENTO", "")),
            "LICENÇA AMBIENTAL": clean_spaces(row.get("LICENÇA AMBIENTAL", "")),
            "CERTIDÃO USO SOLO": clean_spaces(row.get("CERTIDÃO USO SOLO", "")),
        },
    }


def build_extra_licence_for_company(company_row: Dict[str, Any], rule: Dict[str, Any]) -> Dict[str, Any]:
    cnpj = norm_cnpj(company_row.get("cnpj", ""))
    razao = clean_spaces(company_row.get("razao_social", "")) or clean_spaces(rule.get("empresa", ""))
    municipio = municipio_value(company_row.get("municipio", ""))

    if rule.get("ALL") == "NÃO":
        vals = {
            "alvara_vig_sanitaria": "NÃO",
            "cercon": "NÃO",
            "alvara_funcionamento": "NÃO",
            "licenca_ambiental": "NÃO",
            "certidao_uso_solo": "NÃO",
        }
    else:
        vals = {
            "alvara_vig_sanitaria": "*",
            "cercon": "*",
            "alvara_funcionamento": "*",
            "licenca_ambiental": "*",
            "certidao_uso_solo": "*",
        }
        for k in [
            "alvara_vig_sanitaria",
            "cercon",
            "alvara_funcionamento",
            "licenca_ambiental",
            "certidao_uso_solo",
        ]:
            if k in rule:
                vals[k] = rule[k]

    return {
        "cnpj": cnpj,
        "municipio": municipio,
        **vals,
        "raw": {
            "EMPRESA": razao,
            "CNPJ": company_row.get("cnpj", cnpj),
            "MUNICÍPIO": company_row.get("municipio", municipio),
            "ALVARÁ VIG SANITÁRIA": vals["alvara_vig_sanitaria"],
            "CERCON": vals["cercon"],
            "ALVARÁ FUNCIONAMENTO": vals["alvara_funcionamento"],
            "LICENÇA AMBIENTAL": vals["licenca_ambiental"],
            "CERTIDÃO USO SOLO": vals["certidao_uso_solo"],
        },
    }


def dedupe_by_cnpj(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    seen = {}
    duplicates = set()

    # mantém a ÚLTIMA ocorrência
    for item in items:
        cnpj = item.get("cnpj", "")
        if not cnpj:
            continue
        if cnpj in seen:
            duplicates.add(cnpj)
        seen[cnpj] = item

    return list(seen.values()), sorted(duplicates)


def compare_names_with_companies(
    licences: List[Dict[str, Any]],
    companies_by_cnpj: Dict[str, Dict[str, Any]],
) -> Tuple[List[Tuple[str, str, str]], List[Tuple[str, str, str]], List[str], List[str]]:
    exact_mismatch = []
    semantic_mismatch = []
    missing_in_companies = []

    licence_cnpjs = set()

    for lic in licences:
        cnpj = lic.get("cnpj", "")
        if not cnpj:
            continue
        licence_cnpjs.add(cnpj)

        comp = companies_by_cnpj.get(cnpj)
        lic_name = clean_spaces(lic.get("raw", {}).get("EMPRESA", ""))
        if not comp:
            missing_in_companies.append(cnpj)
            continue

        comp_name = clean_spaces(comp.get("razao_social", ""))
        if lic_name != comp_name:
            exact_mismatch.append((cnpj, lic_name, comp_name))

        if name_for_compare(lic_name) != name_for_compare(comp_name):
            semantic_mismatch.append((cnpj, lic_name, comp_name))

    missing_in_licences = sorted(set(companies_by_cnpj.keys()) - licence_cnpjs)

    return (
        exact_mismatch,
        semantic_mismatch,
        sorted(missing_in_companies),
        missing_in_licences,
    )


def main():
    parser = argparse.ArgumentParser(description="Converte licenças TXT/CSV para JSON v2")
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Caminho do TXT/CSV de licenças")
    parser.add_argument("--companies-json", default=DEFAULT_COMPANIES_JSON, help="Caminho do empresas_v2.json")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Caminho do JSON de saída")
    parser.add_argument("--source-name", default=DEFAULT_SOURCE_NAME, help="Nome da origem")
    parser.add_argument("--org-slug", default=DEFAULT_ORG_SLUG, help="Slug da organização")
    parser.add_argument(
        "--add-extra-missing",
        action="store_true",
        help="Adiciona automaticamente empresas faltantes com base em EXTRA_COMPANY_LICENCE_RULES",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    companies_path = Path(args.companies_json)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_path}")
    if not companies_path.exists():
        raise FileNotFoundError(f"Arquivo de companies não encontrado: {companies_path}")

    raw_rows = parse_input_rows(input_path)
    parsed_items = [row_to_licence_obj(r) for r in raw_rows if norm_cnpj(r.get("CNPJ", ""))]

    # dedupe inicial
    licences, duplicated_cnpjs = dedupe_by_cnpj(parsed_items)

    # companies
    companies_by_cnpj = load_companies(companies_path)

    # adicionar empresas faltantes (opcional)
    extras_added = []
    if args.add_extra_missing:
        current_cnpjs = {x["cnpj"] for x in licences}
        for cnpj_digits, rule in EXTRA_COMPANY_LICENCE_RULES.items():
            if cnpj_digits in current_cnpjs:
                continue
            comp = companies_by_cnpj.get(cnpj_digits)
            if not comp:
                continue
            extra = build_extra_licence_for_company(comp, rule)
            licences.append(extra)
            extras_added.append(cnpj_digits)

        # dedupe de novo (caso tenha repetição)
        licences, duplicated_cnpjs_2 = dedupe_by_cnpj(licences)
        duplicated_cnpjs = sorted(set(duplicated_cnpjs) | set(duplicated_cnpjs_2))

    # comparação nomes / cobertura
    exact_mismatch, semantic_mismatch, missing_in_companies, missing_in_licences = compare_names_with_companies(
        licences, companies_by_cnpj
    )

    # ordena por razão social para estabilidade
    def sort_key(item: Dict[str, Any]):
        return (
            clean_spaces(item.get("raw", {}).get("EMPRESA", "")).upper(),
            item.get("cnpj", ""),
        )

    licences_sorted = sorted(licences, key=sort_key)

    output_obj = {
        "source": {
            "type": "spreadsheet_export",
            "name": args.source_name,
            "version": "v1-to-v2-json",
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "org": {"slug": args.org_slug},
        "licences": licences_sorted,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(output_obj, f, ensure_ascii=False, indent=2)

    # ===== logs =====
    print(f"✅ JSON gerado com sucesso: {output_path}")
    print(f"📦 Linhas lidas (válidas): {len(parsed_items)}")
    print(f"🧹 Licenças após deduplicação por CNPJ: {len(licences_sorted)}")

    if duplicated_cnpjs:
        print(f"🔁 CNPJs duplicados removidos ({len(duplicated_cnpjs)} únicos):")
        for c in duplicated_cnpjs:
            print(f"   - {c}")

    if extras_added:
        print(f"➕ Empresas extras adicionadas por regra manual ({len(extras_added)}):")
        for c in extras_added:
            comp = companies_by_cnpj.get(c, {})
            print(f"   - {c} | {comp.get('razao_social', '')}")

    print("\n=== VALIDAÇÃO COM COMPANIES ===")

    if missing_in_companies:
        print(f"⚠️ CNPJs em licenças que NÃO existem em companies ({len(missing_in_companies)}):")
        for c in missing_in_companies:
            print(f"   - {c}")
    else:
        print("✅ Nenhum CNPJ de licenças fora de companies.")

    if missing_in_licences:
        print(f"📌 CNPJs de companies faltando em licenças ({len(missing_in_licences)}):")
        for c in missing_in_licences:
            comp = companies_by_cnpj.get(c, {})
            print(f"   - {c} | {comp.get('razao_social', '')}")
    else:
        print("✅ Todas as companies possuem licença.")

    if exact_mismatch:
        print(f"✏️ Divergências EXATAS de razão social em licenças ({len(exact_mismatch)}):")
        for cnpj, lic_name, comp_name in exact_mismatch:
            print(f"   - {cnpj}")
            print(f"     licenças : {lic_name}")
            print(f"     companies: {comp_name}")
    else:
        print("✅ Nenhuma divergência exata de razão social.")

    # semantic mismatch (ignora acento, caixa, pontuação)
    if semantic_mismatch:
        print(f"🚨 Divergências REAIS de razão social (semânticas) ({len(semantic_mismatch)}):")
        for cnpj, lic_name, comp_name in semantic_mismatch:
            print(f"   - {cnpj}")
            print(f"     licenças : {lic_name}")
            print(f"     companies: {comp_name}")
    else:
        print("✅ Nenhuma divergência real de razão social (ignorando acentos/caixa/pontuação).")


if __name__ == "__main__":
    main()
