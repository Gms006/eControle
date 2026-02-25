# -*- coding: utf-8 -*-
"""
convert_taxes_to_json.py

Converte tabela de TAXAS (copiada da planilha/export em TXT tabulado) para JSON v2
no formato `company_taxes`, com:
- normalização de CNPJ/CPF (e filtro para manter só CNPJ)
- remoção apenas de duplicatas EXATAS de linha
- preservação de múltiplas linhas por CNPJ (ex.: inscrições municipais diferentes)
- status_taxas (heurístico)
- validação contra companies_v2.json (faltantes e razão social divergente)

Uso (PowerShell):
python .\scripts\convert_taxes_to_json.py `
  --input "G:\PMA\SCRIPTS\eControle\scripts\datasets\ingest_content.txt" `
  --output "G:\PMA\SCRIPTS\eControle\docs\ingest_jsons\company_taxes_v2.json" `
  --source-name "TAXAS - NETO CONTABILIDADE 2025" `
  --companies-json "G:\PMA\SCRIPTS\eControle\docs\ingest_jsons\empresas_v2.json"
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


EXPECTED_HEADERS = [
    "EMPRESA",
    "CNPJ",
    "DATA ENVIO",
    "TAXA FUNCIONAMENTO",
    "TAXA PUBLICIDADE",
    "TAXA VIG SANITÁRIA",
    "ISS",
    "TAXA LOCALIZ INSTALAÇÃO",
    "TAXA OCUP ÁREA PÚBLICA",
    "TAXA BOMBEIROS",
    "TPI",
    "VENCIMENTO TPI",
]


def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_doc(doc: str) -> str:
    return re.sub(r"\D", "", doc or "")


def is_cnpj(doc_digits: str) -> bool:
    return len(doc_digits) == 14


def normalize_name_for_compare(name: str) -> str:
    s = strip_accents(name or "").upper()
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return normalize_spaces(s)


def normalize_header_token(token: str) -> str:
    token = strip_accents(token).upper()
    return normalize_spaces(token)


def classify_status_taxas(record: dict) -> str:
    """Heurística simples: Regular / Irregular."""
    fields_to_check = [
        "taxa_funcionamento",
        "taxa_publicidade",
        "taxa_vig_sanitaria",
        "iss",
        "taxa_localiz_instalacao",
        "taxa_ocup_area_publica",
        "taxa_bombeiros",
        "tpi",
    ]
    irregular_patterns = [
        r"\bem aberto\b",
        r"\bcontestar\b",
        r"\bverificar\b",
        r"\baguard",
        r"\bnao possui\b",
        r"\bv[aá]rios exerc",
        r"\bsuspens",
        r"\binativo\b",
        r"\bsaiu\b",
        r"\b\d+/\d+\b",  # 0/3, 1/3 etc
    ]
    neutral_patterns = [
        r"^\*$",
        r"^\-$",
        r"^pago\b",
        r"^j[aá] estava pago\b",
        r"^s[oó] tem\b",
        r"^cliente emite l[aá]\b",
        r"^n[aã]o tinha d[eé]bito no portal\b",
    ]

    found_any_signal = False
    for field in fields_to_check:
        val = normalize_spaces(record.get(field, ""))
        if not val:
            continue

        found_any_signal = True
        v = strip_accents(val).lower()

        if any(re.search(p, v, flags=re.IGNORECASE) for p in irregular_patterns):
            return "Irregular"

        if any(re.search(p, v, flags=re.IGNORECASE) for p in neutral_patterns):
            continue

        # Qualquer outro texto relevante também é tratado como atenção/irregular
        return "Irregular"

    return "Regular" if found_any_signal else "Regular"


def load_companies_map(companies_json_path: Optional[str]) -> Dict[str, str]:
    if not companies_json_path:
        return {}

    p = Path(companies_json_path)
    if not p.exists():
        raise FileNotFoundError(f"companies_json não encontrado: {p}")

    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)

    companies = data.get("companies", [])
    out: Dict[str, str] = {}
    for c in companies:
        doc = normalize_doc(str(c.get("cnpj", "")))
        name = normalize_spaces(str(c.get("razao_social", "")))
        if doc:
            out[doc] = name
    return out


def find_table_lines(text: str) -> List[str]:
    """
    Encontra a tabela de taxas pelo header e retorna as linhas até acabar
    (ou até outra seção incompatível).
    """
    lines = text.splitlines()

    start_idx = None
    expected_norm = [normalize_header_token(x) for x in EXPECTED_HEADERS]

    for i, line in enumerate(lines):
        tokens = [normalize_header_token(t) for t in line.split("\t")]
        if len(tokens) >= len(EXPECTED_HEADERS) and tokens[: len(EXPECTED_HEADERS)] == expected_norm:
            start_idx = i
            break

    if start_idx is None:
        raise ValueError("Cabeçalho da tabela de TAXAS não encontrado no arquivo.")

    table_lines: List[str] = []
    for line in lines[start_idx:]:
        if not line.strip():
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            break

        table_lines.append(line)

    return table_lines


def parse_tax_table(text: str) -> List[dict]:
    table_lines = find_table_lines(text)
    _header = [normalize_spaces(h) for h in table_lines[0].split("\t")[: len(EXPECTED_HEADERS)]]

    rows: List[dict] = []
    for line in table_lines[1:]:
        if not line.strip():
            continue

        parts = [normalize_spaces(p) for p in line.split("\t")]

        if len(parts) < len(EXPECTED_HEADERS):
            parts += [""] * (len(EXPECTED_HEADERS) - len(parts))
        elif len(parts) > len(EXPECTED_HEADERS):
            # Junta excedentes na última coluna
            parts = parts[: len(EXPECTED_HEADERS) - 1] + [" ".join(parts[len(EXPECTED_HEADERS) - 1 :])]

        row = dict(zip(EXPECTED_HEADERS, parts))

        if not normalize_doc(row.get("CNPJ", "")):
            continue

        rows.append(row)

    return rows


def to_output_record(raw_row: dict) -> dict:
    doc = normalize_doc(raw_row.get("CNPJ", ""))
    rec: dict[str, Any] = {
        "cnpj": doc,
        "data_envio": normalize_spaces(raw_row.get("DATA ENVIO", "")),
        "taxa_funcionamento": normalize_spaces(raw_row.get("TAXA FUNCIONAMENTO", "")),
        "taxa_publicidade": normalize_spaces(raw_row.get("TAXA PUBLICIDADE", "")),
        "taxa_vig_sanitaria": normalize_spaces(raw_row.get("TAXA VIG SANITÁRIA", "")),
        "iss": normalize_spaces(raw_row.get("ISS", "")),
        "taxa_localiz_instalacao": normalize_spaces(raw_row.get("TAXA LOCALIZ INSTALAÇÃO", "")),
        "taxa_ocup_area_publica": normalize_spaces(raw_row.get("TAXA OCUP ÁREA PÚBLICA", "")),
        "taxa_bombeiros": normalize_spaces(raw_row.get("TAXA BOMBEIROS", "")),
        "tpi": normalize_spaces(raw_row.get("TPI", "")),
        "vencimento_tpi": normalize_spaces(raw_row.get("VENCIMENTO TPI", "")),
    }
    rec["status_taxas"] = classify_status_taxas(rec)
    rec["raw"] = {k: normalize_spaces(raw_row.get(k, "")) for k in EXPECTED_HEADERS}
    rec["raw"]["status_taxas"] = rec["status_taxas"]
    return rec


def main() -> None:
    parser = argparse.ArgumentParser(description="Converte tabela de TAXAS para JSON v2")
    parser.add_argument("--input", required=True, help="TXT com conteúdo tabulado")
    parser.add_argument("--output", required=True, help="JSON de saída")
    parser.add_argument("--source-name", default="TAXAS - NETO CONTABILIDADE 2025", help="Nome da fonte no JSON")
    parser.add_argument("--companies-json", default="", help="empresas_v2.json para validar CNPJs e razão social")
    parser.add_argument("--org-slug", default="neto-contabilidade", help="Slug da organização")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_path}")

    text = input_path.read_text(encoding="utf-8", errors="ignore")
    raw_rows = parse_tax_table(text)

    companies_map = load_companies_map(args.companies_json) if args.companies_json else {}

    total_valid = 0
    taxes: List[dict] = []
    seen_exact_rows = set()  # remove somente duplicata EXATA
    cnpj_line_counts: Dict[str, int] = {}
    mismatched_names: List[Dict[str, str]] = []

    for raw in raw_rows:
        doc = normalize_doc(raw.get("CNPJ", ""))
        if not doc:
            continue

        # Ignorar CPF por enquanto
        if not is_cnpj(doc):
            continue

        rec = to_output_record(raw)
        total_valid += 1

        # Divergência de razão social (comparando com companies)
        if companies_map and doc in companies_map:
            companies_name = companies_map[doc]
            tax_name = normalize_spaces(raw.get("EMPRESA", ""))
            if normalize_name_for_compare(companies_name) != normalize_name_for_compare(tax_name):
                mismatched_names.append(
                    {
                        "cnpj": doc,
                        "companies": companies_name,
                        "taxes": tax_name,
                    }
                )

        # Duplicata EXATA (inclui EMPRESA para não colapsar variações de nome)
        exact_key = (
            rec["cnpj"],
            rec.get("raw", {}).get("EMPRESA", ""),
            rec.get("data_envio", ""),
            rec.get("taxa_funcionamento", ""),
            rec.get("taxa_publicidade", ""),
            rec.get("taxa_vig_sanitaria", ""),
            rec.get("iss", ""),
            rec.get("taxa_localiz_instalacao", ""),
            rec.get("taxa_ocup_area_publica", ""),
            rec.get("taxa_bombeiros", ""),
            rec.get("tpi", ""),
            rec.get("vencimento_tpi", ""),
        )
        if exact_key in seen_exact_rows:
            continue
        seen_exact_rows.add(exact_key)

        # Conta apenas as linhas efetivamente incluídas no JSON
        cnpj_line_counts[doc] = cnpj_line_counts.get(doc, 0) + 1

        taxes.append(rec)

    # Ordena por CNPJ + data_envio + nome no raw
    taxes.sort(
        key=lambda x: (
            x["cnpj"],
            normalize_spaces(x.get("data_envio", "")),
            normalize_spaces(x.get("raw", {}).get("EMPRESA", "")),
        )
    )

    output = {
        "source": {
            "type": "spreadsheet_export",
            "name": args.source_name,
            "version": "v1-to-v2-json",
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "org": {"slug": args.org_slug},
        "taxes": taxes,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    tax_docs_unique = {t["cnpj"] for t in taxes}
    company_docs = set(companies_map.keys()) if companies_map else set()

    missing_in_companies: List[Dict[str, str]] = []
    missing_companies_in_taxes: List[Dict[str, str]] = []

    if companies_map:
        for t in taxes:
            d = t["cnpj"]
            if d not in company_docs:
                missing_in_companies.append({"doc": d, "nome_taxes": t["raw"].get("EMPRESA", "")})

        # remove repetidos se mesmo CNPJ apareceu mais de uma vez
        tmp = {}
        for x in missing_in_companies:
            tmp[x["doc"]] = x
        missing_in_companies = sorted(tmp.values(), key=lambda x: x["doc"])

        missing_companies_in_taxes = [
            {"cnpj": d, "razao_social": companies_map[d]}
            for d in company_docs
            if d not in tax_docs_unique
        ]
        missing_companies_in_taxes.sort(key=lambda x: x["cnpj"])

    print(f"✅ JSON gerado com sucesso: {output_path}")
    print(f"📦 Linhas lidas (válidas, só CNPJ): {total_valid}")
    print(f"🧾 Registros gerados (linhas preservadas): {len(taxes)}")

    # CNPJs com múltiplas linhas (ex.: múltiplas inscrições municipais)
    multi_rows = {k: v for k, v in cnpj_line_counts.items() if v > 1}
    if multi_rows:
        print(f"🏛️ CNPJs com múltiplas linhas (possíveis múltiplas inscrições municipais): {len(multi_rows)}")
        for d, n in sorted(multi_rows.items()):
            nomes = sorted({t['raw'].get('EMPRESA', '') for t in taxes if t['cnpj'] == d})
            print(f"   - {d} -> {n} linhas | {' / '.join(nomes)}")

    if companies_map:
        print(f"🏢 Registros de taxas NÃO encontrados em companies: {len(missing_in_companies)}")
        for x in missing_in_companies:
            print(f"   - {x['doc']} | {x['nome_taxes']}")

        print(f"📭 Empresas de companies sem registro em taxes: {len(missing_companies_in_taxes)}")
        for x in missing_companies_in_taxes[:30]:
            print(f"   - {x['cnpj']} | {x['razao_social']}")
        if len(missing_companies_in_taxes) > 30:
            print(f"   ... (+{len(missing_companies_in_taxes)-30} restantes)")

        if mismatched_names:
            print(f"⚠️ Razão social divergente por CNPJ (taxes x companies): {len(mismatched_names)}")
            seen = set()
            for item in mismatched_names:
                key = (item["cnpj"], item["companies"], item["taxes"])
                if key in seen:
                    continue
                seen.add(key)
                print(f"   - {item['cnpj']}")
                print(f"     companies: {item['companies']}")
                print(f"     taxes    : {item['taxes']}")


if __name__ == "__main__":
    main()