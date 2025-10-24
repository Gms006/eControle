"""Command line interface for the ETL pipeline."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import sqlalchemy as sa
import typer
from sqlalchemy.engine import Engine

from .contracts import load_contract
from .extract_xlsm import load as load_source
from .load_upsert import run as run_loader
from .transform_normalize import transform

app = typer.Typer(help="Importa planilhas XLSM/XLSX/CSV para o Postgres do eControle")


def _get_engine() -> Engine:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise typer.BadParameter("DATABASE_URL não definido nas variáveis de ambiente")
    return sa.create_engine(database_url, future=True)


@app.command("import")
def import_command(
    source: Path = typer.Argument(..., exists=True, readable=True, help="Arquivo XLSM/XLSX/CSV"),
    dry_run: bool = typer.Option(True, help="Executa sem commitar alterações"),
) -> None:
    contract = load_contract()
    raw_data = load_source(source, contract)
    normalized = transform(raw_data, contract)
    engine = _get_engine()
    results = run_loader(engine, normalized, file_source=str(source), dry_run=dry_run)
    for row in results:
        typer.echo(json.dumps(row, ensure_ascii=False, default=str))


if __name__ == "__main__":
    app()
