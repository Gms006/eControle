
"""Data extraction helpers for Excel/CSV sources."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from openpyxl import load_workbook

from .contracts import ConfigContract
from .normalizers import normalize_text

ROW_NUMBER_KEY = "__row_number__"


def load(source: str | Path, contract: ConfigContract) -> Dict[str, Any]:
    path = Path(source)
    suffix = path.suffix.lower()
    if suffix in {".xlsx", ".xlsm", ".xls"}:
        return _load_excel(path, contract)
    if suffix == ".csv":
        return {"empresas": _load_csv(path)}
    raise ValueError(f"Formato não suportado: {suffix}")


def _load_csv(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handler:
        reader = csv.DictReader(handler)
        rows: List[Dict[str, Any]] = []
        for index, row in enumerate(reader, start=2):
            row_data = {key: value for key, value in row.items()}
            row_data[ROW_NUMBER_KEY] = index
            rows.append(row_data)
    return rows


def _load_excel(path: Path, contract: ConfigContract) -> Dict[str, Any]:
    workbook = load_workbook(filename=path, read_only=False, data_only=True, keep_vba=True)
    data: Dict[str, Any] = {}
    for logical_sheet, sheet_name in contract.sheet_names.items():
        if sheet_name not in workbook.sheetnames:
            continue
        worksheet = workbook[sheet_name]
        if logical_sheet in {"processos", "uteis", "certificados", "certificados_agendamentos"}:
            tables_map = contract.table_names.get(logical_sheet, {})
            data[logical_sheet] = _load_tables(worksheet, tables_map)
        else:
            data[logical_sheet] = _load_worksheet(worksheet)
    return data


def _load_tables(worksheet, tables_map: Dict[str, str]) -> Dict[str, List[Dict[str, Any]]]:
    tables: Dict[str, List[Dict[str, Any]]] = {}
    for logical_table, table_name in tables_map.items():
        if table_name not in worksheet.tables:
            continue
        table = worksheet.tables[table_name]
        cells = worksheet[table.ref]
        rows = _rows_from_cells(cells)
        tables[logical_table] = rows
    return tables


def _load_worksheet(worksheet) -> List[Dict[str, Any]]:
    cells = worksheet.iter_rows()
    return _rows_from_cells(cells)


def _rows_from_cells(cells: Iterable[Iterable[Any]]) -> List[Dict[str, Any]]:
    iterator = iter(cells)
    try:
        header_row = next(iterator)
    except StopIteration:
        return []
    headers = [normalize_text(cell.value) or "" for cell in header_row]
    rows: List[Dict[str, Any]] = []
    for row in iterator:
        values = [cell.value for cell in row]
        if _is_empty_row(values):
            continue
        record: Dict[str, Any] = {}
        for header, cell in zip(headers, row):
            record[header] = cell.value
        first_cell = row[0]
        record[ROW_NUMBER_KEY] = getattr(first_cell, "row", len(rows) + 2)
        rows.append(record)
    return rows


def _is_empty_row(values: Iterable[Any]) -> bool:
    for value in values:
        if value not in (None, ""):
            if isinstance(value, str) and not value.strip():
                continue
            return False
    return True
