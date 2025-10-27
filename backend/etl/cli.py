"""Command line interface for the ETL pipeline."""
from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import sqlalchemy as sa
import typer

from .contracts import load_contract
from .extract_xlsm import load as load_source
from .load_upsert import run as run_loader
from .transform_normalize import transform

app = typer.Typer(add_completion=False, help="Comandos do ETL idempotente do eControle.")


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context) -> None:
    """Exibe ajuda quando nenhum subcomando é informado."""

    if ctx.invoked_subcommand is None:
        typer.echo(ctx.get_help())
        raise typer.Exit()


@app.command("import")
def import_command(
    source: Path = typer.Argument(..., exists=True, readable=True, help="Arquivo XLSM/XLSX/CSV"),
    dry_run: bool = typer.Option(True, help="Executa sem commitar alterações"),
    file_source: str | None = typer.Option(None, help="Rótulo amigável para o arquivo"),
) -> None:
    run_id = str(uuid.uuid4())
    file_label = file_source or source.name

    contract = load_contract()
    raw_data = load_source(source, contract)
    normalized = transform(raw_data, contract)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não definido no ambiente")

    engine = sa.create_engine(database_url, future=True)
    results = run_loader(
        engine,
        normalized,
        run_id=run_id,
        file_source=file_label,
        dry_run=dry_run,
    )

    typer.echo(
        json.dumps(
            {"run_id": run_id, "dry_run": dry_run, "file_source": file_label, "results": results},
            ensure_ascii=False,
            default=str,
        )
    )


if __name__ == "__main__":
    app()
