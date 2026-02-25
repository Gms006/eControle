# -*- coding: utf-8 -*-
"""
processes_json_creator.py

Converte tabela(s) de PROCESSOS (copiada da planilha/export em TXT tabulado) para JSON v2
no formato `company_processes`, com:
- normalização de CNPJ/CPF
- filtro: só gera registro quando PROTOCOLO existir
- IGNORA CPF por padrão (pode habilitar com --allow-cpf)
- append no mesmo JSON de saída (se existir)
- deduplicação por (cnpj, process_type, protocolo)
- validação contra companies_v2.json (faltantes e razão social divergente)

Uso (PowerShell):
python "G:\PMA\SCRIPTS\eControle\scripts\datasets\processes_json_creator.py" `
  --input "G:\PMA\SCRIPTS\eControle\scripts\datasets\ingest_content.txt" `
  --companies-json "G:\PMA\SCRIPTS\eControle\docs\ingest_jsons\empresas_v2.json" `
  --output "G:\PMA\SCRIPTS\eControle\docs\ingest_jsons\processes_v2.json" `
  --source-name "PROCESSOS - NETO CONTABILIDADE 2025" `
  --process-type "CERCON" `
  --municipio "ANÁPOLIS"

Observação:
- Rode 1 tipo de processo por vez (CERCON, USO_SOLO, ALVARA_SANITARIO, etc.)
- Use sempre o MESMO --output para ir acumulando tudo no mesmo JSON.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# =========================
# Utilitários de texto
# =========================

def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_doc(doc: str) -> str:
    return re.sub(r"\D", "", doc or "")


def is_cnpj(doc_digits: str) -> bool:
    return len(doc_digits) == 14


def is_cpf(doc_digits: str) -> bool:
    return len(doc_digits) == 11


def normalize_name_for_compare(name: str) -> str:
    s = strip_accents(name or "").upper()
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    s = normalize_spaces(s)
    return s


def normalize_header_token(token: str) -> str:
    token = strip_accents(token or "").upper()
    token = normalize_spaces(token)
    return token


def slugify_extra_key(header: str) -> str:
    s = strip_accents(header or "").lower()
    s = normalize_spaces(s)
    s = s.replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "campo_extra"


def has_value(v: str) -> bool:
    v = normalize_spaces(v)
    return v not in {"", "-", "*"}


# =========================
# Mapeamento de cabeçalhos
# =========================

# Cabeçalhos padrão (normalizados)
HDR_EMPRESA = "EMPRESA"
HDR_CNPJ = "CNPJ"
HDR_PROTOCOLO = "PROTOCOLO"
HDR_MUNICIPIO = "MUNICIPIO"
HDR_ORGAO = "ORGAO"
HDR_OPERACAO = "OPERACAO"
HDR_DATA_SOLIC = "DATA SOLICITACAO"
HDR_SITUACAO = "SITUACAO"
HDR_OBS = "OBS"

# Aliases (normalizados)
HEADER_ALIASES = {
    "EMPRESA": HDR_EMPRESA,
    "RAZAO SOCIAL": HDR_EMPRESA,

    "CNPJ": HDR_CNPJ,
    "CPF/CNPJ": HDR_CNPJ,
    "CPF CNPJ": HDR_CNPJ,
    "DOCUMENTO": HDR_CNPJ,

    "PROTOCOLO": HDR_PROTOCOLO,
    "N PROTOCOLO": HDR_PROTOCOLO,
    "NUMERO PROTOCOLO": HDR_PROTOCOLO,

    "MUNICIPIO": HDR_MUNICIPIO,
    "MUNICIPIO/UF": HDR_MUNICIPIO,

    "ORGAO": HDR_ORGAO,

    "OPERACAO": HDR_OPERACAO,
    "TIPO OPERACAO": HDR_OPERACAO,
    "SERVICO": HDR_OPERACAO,  # em algumas tabelas o "serviço" é a operação principal

    "DATA SOLICITACAO": HDR_DATA_SOLIC,
    "DATA SOLICITACAO/ABERTURA": HDR_DATA_SOLIC,
    "DATA": HDR_DATA_SOLIC,

    "SITUACAO": HDR_SITUACAO,
    "STATUS": HDR_SITUACAO,

    "OBS": HDR_OBS,
    "OBSERVACAO": HDR_OBS,
    "OBSERVACOES": HDR_OBS,
}


def canonical_header(raw_header: str) -> str:
    n = normalize_header_token(raw_header)
    return HEADER_ALIASES.get(n, n)


# =========================
# Qualidade / merge
# =========================

def quality_score(value: str) -> int:
    """Maior score = mais informativo."""
    if value is None:
        return 0
    v = normalize_spaces(value)
    if v == "":
        return 0

    if v in {"*", "-"}:
        return 1

    v_upper = strip_accents(v).upper()

    strong_keywords = [
        "EM ANALISE", "EM ANÁLISE",
        "AGUARD", "CONCLUID",
        "PEND", "PROTOCOLO",
        "VENCIMENTO", "CANCEL",
        "NOTIFIC", "PAGTO",
        "VISTORIA",
    ]
    if any(k in v_upper for k in strong_keywords):
        return 15 + min(len(v), 100) // 8

    # Tem data
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", v):
        return 12 + min(len(v), 60) // 10

    # Valor genérico
    return 8 + min(len(v), 60) // 10


def choose_better_value(old: str, new: str) -> str:
    old_n = normalize_spaces(old or "")
    new_n = normalize_spaces(new or "")
    if not old_n:
        return new_n
    if not new_n:
        return old_n

    so = quality_score(old_n)
    sn = quality_score(new_n)
    if sn > so:
        return new_n
    return old_n


# =========================
# Leitura de companies
# =========================

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


# =========================
# Parsing do TXT tabulado
# =========================

def line_looks_like_header(line: str) -> bool:
    if "\t" not in line:
        return False
    tokens = [canonical_header(t) for t in line.split("\t")]
    token_set = set(tokens)
    required = {HDR_EMPRESA, HDR_CNPJ, HDR_PROTOCOLO}
    return required.issubset(token_set)


def find_table_lines(text: str) -> List[str]:
    """
    Encontra a primeira tabela de processos no TXT pelo cabeçalho.
    A tabela precisa conter pelo menos EMPRESA, CNPJ e PROTOCOLO.
    """
    lines = text.splitlines()

    start_idx = None
    for i, line in enumerate(lines):
        if line_looks_like_header(line):
            start_idx = i
            break

    if start_idx is None:
        raise ValueError(
            "Cabeçalho da tabela de PROCESSOS não encontrado.\n"
            "A tabela precisa conter colunas como EMPRESA, CNPJ e PROTOCOLO."
        )

    table_lines: List[str] = []
    for line in lines[start_idx:]:
        # Se chegou em linha sem tabulação e já capturou dados, encerra
        if "\t" not in line and table_lines:
            break

        # Se não tem tab, ignora (antes de começar)
        if "\t" not in line:
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            break

        table_lines.append(line)

    if len(table_lines) < 2:
        raise ValueError("Tabela encontrada, mas sem linhas de dados.")

    return table_lines


def parse_process_table(text: str) -> Tuple[List[dict], List[str]]:
    """
    Retorna:
      - rows: lista de dicts (preservando cabeçalhos originais)
      - headers_raw: cabeçalhos originais da tabela
    """
    table_lines = find_table_lines(text)

    headers_raw = [normalize_spaces(h) for h in table_lines[0].split("\t")]
    header_count = len(headers_raw)

    rows: List[dict] = []
    for line in table_lines[1:]:
        if not line.strip():
            continue

        parts = [normalize_spaces(p) for p in line.split("\t")]

        if len(parts) < header_count:
            parts += [""] * (header_count - len(parts))
        elif len(parts) > header_count:
            # Junta excedente na última coluna
            parts = parts[:header_count - 1] + [" ".join(parts[header_count - 1:])]

        row = dict(zip(headers_raw, parts))

        # Ignora linha vazia/ruim
        if not any(normalize_spaces(v) for v in row.values()):
            continue

        rows.append(row)

    return rows, headers_raw


# =========================
# Conversão para schema v2
# =========================

STANDARD_FIELDS = {
    HDR_EMPRESA,
    HDR_CNPJ,
    HDR_PROTOCOLO,
    HDR_MUNICIPIO,
    HDR_ORGAO,
    HDR_OPERACAO,
    HDR_DATA_SOLIC,
    HDR_SITUACAO,
    HDR_OBS,
}


def build_canonical_row(raw_row: Dict[str, str]) -> Dict[str, str]:
    """
    Mapeia cabeçalhos da linha (originais) -> cabeçalho canônico normalizado
    """
    out: Dict[str, str] = {}
    for k, v in raw_row.items():
        ck = canonical_header(k)
        # Se houver duplicidade por alias, mantém o mais informativo
        if ck in out:
            out[ck] = choose_better_value(out[ck], v)
        else:
            out[ck] = normalize_spaces(v)
    return out


def to_output_record(
    raw_row: Dict[str, str],
    process_type: str,
    default_municipio: str,
    default_orgao: str,
) -> Optional[dict]:
    crow = build_canonical_row(raw_row)

    doc_raw = crow.get(HDR_CNPJ, "")
    doc = normalize_doc(doc_raw)
    protocolo = normalize_spaces(crow.get(HDR_PROTOCOLO, ""))

    # Só gera se tiver documento e protocolo
    if not doc:
        return None
    if normalize_spaces(protocolo) in {"", "-", "*"}:
        return None

    municipio = normalize_spaces(crow.get(HDR_MUNICIPIO, "")) or normalize_spaces(default_municipio)
    orgao = normalize_spaces(crow.get(HDR_ORGAO, "")) or normalize_spaces(default_orgao)
    operacao = normalize_spaces(crow.get(HDR_OPERACAO, ""))
    data_solic = normalize_spaces(crow.get(HDR_DATA_SOLIC, ""))
    situacao = normalize_spaces(crow.get(HDR_SITUACAO, ""))
    obs = normalize_spaces(crow.get(HDR_OBS, ""))

    # extra = tudo que não é campo padrão e esteja preenchido
    extra: Dict[str, str] = {}
    for raw_key, raw_val in raw_row.items():
        val = normalize_spaces(raw_val)
        if val == "":
            continue
        ckey = canonical_header(raw_key)
        if ckey in STANDARD_FIELDS:
            continue

        extra_key = slugify_extra_key(raw_key)
        if extra_key in extra:
            extra[extra_key] = choose_better_value(extra[extra_key], val)
        else:
            extra[extra_key] = val

    rec: Dict[str, Any] = {
        "cnpj": doc,  # mantido como "cnpj" por compatibilidade do schema atual
        "process_type": normalize_spaces(process_type).upper(),
        "protocolo": protocolo,
        "municipio": municipio.upper() if municipio else "",
        "extra": extra,
        "raw": {normalize_spaces(k): normalize_spaces(v) for k, v in raw_row.items()},
    }

    # Campos opcionais
    if orgao:
        rec["orgao"] = orgao.upper()
    if operacao:
        rec["operacao"] = operacao
    if data_solic:
        rec["data_solicitacao"] = data_solic
    if situacao:
        rec["situacao"] = situacao
    if obs:
        rec["obs"] = obs

    return rec


def merge_process_records(base: dict, new: dict) -> dict:
    """
    Merge por chave única (cnpj + process_type + protocolo):
    - mantém melhor valor em campos opcionais
    - mescla extra
    - mescla raw
    """
    merged = deepcopy(base)

    # Campos simples / opcionais
    for k in ["municipio", "orgao", "operacao", "data_solicitacao", "situacao", "obs"]:
        old_v = merged.get(k, "")
        new_v = new.get(k, "")
        chosen = choose_better_value(old_v, new_v)
        if chosen:
            merged[k] = chosen
        elif k in merged and not chosen:
            # mantém se já existe
            pass

    # Extra
    merged_extra = deepcopy(merged.get("extra", {}) or {})
    new_extra = new.get("extra", {}) or {}
    for k, v in new_extra.items():
        if k in merged_extra:
            merged_extra[k] = choose_better_value(merged_extra[k], v)
        else:
            merged_extra[k] = v
    merged["extra"] = merged_extra

    # Raw (preserva tudo)
    merged_raw = deepcopy(merged.get("raw", {}) or {})
    new_raw = new.get("raw", {}) or {}
    for k, v in new_raw.items():
        if k in merged_raw:
            merged_raw[k] = choose_better_value(merged_raw[k], v)
        else:
            merged_raw[k] = v
    merged["raw"] = merged_raw

    return merged


# =========================
# Carregar/salvar JSON de saída (append)
# =========================

def load_existing_output(output_path: Path, source_name: str, org_slug: str) -> dict:
    if output_path.exists():
        with output_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            raise ValueError("JSON de saída existente inválido (não é objeto).")

        if "processes" not in data:
            # Se existir mas veio de outro schema, tenta inicializar preservando estrutura mínima
            data["processes"] = []

        if "source" not in data:
            data["source"] = {}
        if "org" not in data:
            data["org"] = {"slug": org_slug}

        # Atualiza metadados da geração atual
        data["source"]["type"] = "spreadsheet_export"
        data["source"]["name"] = source_name
        data["source"]["version"] = "v1-to-v2-json"
        data["source"]["generated_at"] = (
            datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        )
        data["org"]["slug"] = org_slug
        return data

    # Se não existir, cria estrutura nova
    return {
        "source": {
            "type": "spreadsheet_export",
            "name": source_name,
            "version": "v1-to-v2-json",
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "org": {"slug": org_slug},
        "processes": [],
    }


# =========================
# Main
# =========================

def main() -> None:
    parser = argparse.ArgumentParser(description="Converte tabela de PROCESSOS para JSON v2 (append)")
    parser.add_argument("--input", required=True, help="TXT com conteúdo tabulado")
    parser.add_argument("--output", required=True, help="JSON de saída (append se já existir)")
    parser.add_argument("--source-name", required=True, help="Nome da fonte no JSON (ex.: PROCESSOS - NETO CONTABILIDADE 2025)")
    parser.add_argument("--process-type", required=True, help="Tipo do processo (ex.: CERCON, USO_SOLO, ALVARA_SANITARIO, DIVERSOS)")
    parser.add_argument("--companies-json", default="", help="empresas_v2.json para validar CNPJs e razão social")
    parser.add_argument("--municipio", default="ANÁPOLIS", help="Município padrão se coluna MUNICÍPIO não existir")
    parser.add_argument("--orgao", default="", help="Órgão padrão se coluna ÓRGÃO não existir (ex.: PREFEITURA)")
    parser.add_argument("--org-slug", default="neto-contabilidade", help="Slug da organização")
    parser.add_argument("--allow-cpf", action="store_true", help="Se informado, aceita CPF também (padrão: ignora CPF)")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_path}")

    text = input_path.read_text(encoding="utf-8", errors="ignore")
    raw_rows, headers_raw = parse_process_table(text)

    companies_map = load_companies_map(args.companies_json) if args.companies_json else {}

    # Carrega JSON existente (append)
    output_data = load_existing_output(output_path, args.source_name, args.org_slug)
    existing_processes: List[dict] = output_data.get("processes", [])

    # Índice para merge/dedup
    process_index: Dict[Tuple[str, str, str], int] = {}
    for idx, p in enumerate(existing_processes):
        key = (
            normalize_doc(str(p.get("cnpj", ""))),
            normalize_spaces(str(p.get("process_type", ""))).upper(),
            normalize_spaces(str(p.get("protocolo", ""))),
        )
        if all(key):
            process_index[key] = idx

    total_rows = 0
    skipped_no_doc = 0
    skipped_cpf = 0
    skipped_no_protocolo = 0
    inserted = 0
    merged_count = 0

    missing_in_companies: Dict[str, dict] = {}
    mismatched_names: List[dict] = []

    seen_exact_lines = set()

    for raw in raw_rows:
        total_rows += 1

        crow = build_canonical_row(raw)
        doc = normalize_doc(crow.get(HDR_CNPJ, ""))
        protocolo = normalize_spaces(crow.get(HDR_PROTOCOLO, ""))

        if not doc:
            skipped_no_doc += 1
            continue

        if is_cpf(doc) and not args.allow_cpf:
            skipped_cpf += 1
            continue

        if normalize_spaces(protocolo) in {"", "-", "*"}:
            skipped_no_protocolo += 1
            continue

        # evita duplicata exata da mesma linha no mesmo arquivo
        exact_key = tuple(normalize_spaces(raw.get(h, "")) for h in headers_raw)
        if exact_key in seen_exact_lines:
            continue
        seen_exact_lines.add(exact_key)

        rec = to_output_record(
            raw_row=raw,
            process_type=args.process_type,
            default_municipio=args.municipio,
            default_orgao=args.orgao,
        )
        if rec is None:
            continue

        # validação companies (só CNPJ)
        if companies_map and is_cnpj(rec["cnpj"]):
            tax_name = normalize_spaces(rec["raw"].get("EMPRESA", ""))
            comp_name = companies_map.get(rec["cnpj"])
            if comp_name is None:
                missing_in_companies[rec["cnpj"]] = {
                    "cnpj": rec["cnpj"],
                    "nome_processos": tax_name,
                }
            else:
                if normalize_name_for_compare(comp_name) != normalize_name_for_compare(tax_name):
                    mismatched_names.append({
                        "cnpj": rec["cnpj"],
                        "companies": comp_name,
                        "processes": tax_name,
                    })

        # chave única de processo
        key = (
            rec["cnpj"],
            normalize_spaces(rec["process_type"]).upper(),
            normalize_spaces(rec["protocolo"]),
        )

        if key in process_index:
            idx = process_index[key]
            existing_processes[idx] = merge_process_records(existing_processes[idx], rec)
            merged_count += 1
        else:
            existing_processes.append(rec)
            process_index[key] = len(existing_processes) - 1
            inserted += 1

    # Ordenação final
    existing_processes.sort(
        key=lambda x: (
            len(normalize_doc(str(x.get("cnpj", "")))),
            normalize_doc(str(x.get("cnpj", ""))),
            normalize_spaces(str(x.get("process_type", ""))).upper(),
            normalize_spaces(str(x.get("protocolo", ""))),
        )
    )

    output_data["processes"] = existing_processes
    output_data["source"]["generated_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    output_data["source"]["name"] = args.source_name
    output_data["source"]["version"] = "v1-to-v2-json"
    output_data["source"]["type"] = "spreadsheet_export"
    output_data["org"] = {"slug": args.org_slug}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    # Saída de terminal
    print(f"✅ JSON de processos atualizado: {output_path}")
    print(f"📋 Tipo processado: {normalize_spaces(args.process_type).upper()}")
    print(f"📦 Linhas lidas na tabela: {total_rows}")
    print(f"⛔ Ignoradas sem documento: {skipped_no_doc}")
    print(f"⛔ Ignoradas sem protocolo: {skipped_no_protocolo}")
    if not args.allow_cpf:
        print(f"⛔ CPFs ignorados: {skipped_cpf}")
    else:
        print(f"🪪 CPFs permitidos nesta execução")
    print(f"➕ Inseridos no JSON: {inserted}")
    print(f"🔁 Mesclados (já existiam por cnpj+tipo+protocolo): {merged_count}")
    print(f"🧾 Total no arquivo processes: {len(existing_processes)}")

    if companies_map:
        missing_list = sorted(missing_in_companies.values(), key=lambda x: x["cnpj"])
        print(f"🏢 Processos com CNPJ não encontrado em companies: {len(missing_list)}")
        for x in missing_list:
            print(f"   - {x['cnpj']} | {x['nome_processos']}")

        # remove duplicadas
        unique_mismatches = []
        seen_m = set()
        for m in mismatched_names:
            k = (m["cnpj"], m["companies"], m["processes"])
            if k in seen_m:
                continue
            seen_m.add(k)
            unique_mismatches.append(m)

        print(f"⚠️ Razão social divergente por CNPJ (processes x companies): {len(unique_mismatches)}")
        for m in unique_mismatches:
            print(f"   - {m['cnpj']}")
            print(f"     companies: {m['companies']}")
            print(f"     processes: {m['processes']}")


if __name__ == "__main__":
    main()
