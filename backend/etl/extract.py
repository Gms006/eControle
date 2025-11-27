"""Data extraction helpers for flat files.

Only CSV inputs are supported; other formats must be ingested via API/DB
pipelines.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List

from .contracts import ConfigContract

ROW_NUMBER_KEY = "__row_number__"


def load(source: str | Path, contract: ConfigContract) -> Dict[str, Any]:
    path = Path(source)
    suffix = path.suffix.lower()
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

