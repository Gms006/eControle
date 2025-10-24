"""Load step: writes staging rows and performs idempotent upserts."""
from __future__ import annotations

import json
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection, Engine

from .normalizers import make_row_hash, only_digits
from .transform_normalize import NormalizedRow

FINAL_TABLES = {"empresas", "licencas", "taxas", "processos"}


@dataclass(slots=True)
class LoadResult:
    run_id: str
    sheet: str
    row_number: int
    table: str
    action: str
    changed_fields: List[str]


def run(
    engine: Engine,
    normalized: Dict[str, List[NormalizedRow]],
    file_source: str,
    dry_run: bool = True,
) -> List[Dict[str, Any]]:
    run_id = str(uuid4())
    with _transaction(engine, dry_run) as connection:
        metadata = sa.MetaData()
        metadata.reflect(connection, only={
            "empresas",
            "licencas",
            "taxas",
            "processos",
            "stg_empresas",
            "stg_licencas",
            "stg_taxas",
            "stg_processos",
            "stg_certificados",
            "stg_certificados_agendamentos",
        })
        empresas_table = metadata.tables["empresas"]
        staging_tables = {
            name: metadata.tables[name]
            for name in (
                "stg_empresas",
                "stg_licencas",
                "stg_taxas",
                "stg_processos",
                "stg_certificados",
                "stg_certificados_agendamentos",
            )
        }
        results: List[Dict[str, Any]] = []
        empresa_cache: Dict[str, int] = {}

        ordered_tables = ["empresas", "licencas", "taxas", "processos", "certificados", "certificados_agendamentos"]
        for table in ordered_tables:
            rows = normalized.get(table, [])
            for item in rows:
                staging_table = staging_tables[f"stg_{table}"]
                payload = dict(item.payload)
                row_hash = make_row_hash(item.table, item.row_number, json.dumps(payload, sort_keys=True, default=str))
                _insert_staging(connection, staging_table, run_id, file_source, item.row_number, row_hash, payload)
                if table not in FINAL_TABLES:
                    results.append(
                        {
                            "run_id": run_id,
                            "sheet": item.sheet,
                            "row_number": item.row_number,
                            "table": table,
                            "action": "insert",
                            "changed_fields": [],
                        }
                    )
                    continue
                action, changed = _upsert_final(
                    connection,
                    table,
                    payload,
                    empresa_cache,
                    empresas_table,
                    metadata.tables[table],
                )
                results.append(
                    {
                        "run_id": run_id,
                        "sheet": item.sheet,
                        "row_number": item.row_number,
                        "table": table,
                        "action": action,
                        "changed_fields": changed,
                    }
                )
        return results


@contextmanager
def _transaction(engine: Engine, dry_run: bool):
    connection = engine.connect()
    trans = connection.begin()
    try:
        yield connection
        if dry_run:
            trans.rollback()
        else:
            trans.commit()
    finally:
        connection.close()


def _insert_staging(
    connection: Connection,
    table: sa.Table,
    run_id: str,
    file_source: str,
    row_number: int,
    row_hash: str,
    payload: Dict[str, Any],
) -> None:
    value = (
        payload
        if connection.dialect.name == "postgresql"
        else json.dumps(payload, ensure_ascii=False, default=str)
    )
    stmt = table.insert().values(
        run_id=run_id,
        file_source=file_source,
        row_number=row_number,
        row_hash=row_hash,
        payload=value,
    )
    connection.execute(stmt)


def _upsert_final(
    connection: Connection,
    table_name: str,
    payload: Dict[str, Any],
    empresa_cache: Dict[str, int],
    empresas_table: sa.Table,
    table: sa.Table,
) -> tuple[str, List[str]]:
    final_payload = dict(payload)
    if table_name != "empresas":
        empresa_id = _resolve_empresa_id(connection, empresas_table, empresa_cache, final_payload.get("empresa_cnpj"))
        if not empresa_id:
            raise ValueError(f"Empresa não encontrada para CNPJ {final_payload.get('empresa_cnpj')}")
        final_payload["empresa_id"] = empresa_id
        final_payload.pop("empresa_cnpj", None)
    else:
        empresa_id = None

    select_stmt, natural_key_cols = _build_natural_key(table_name, table, final_payload, empresa_id)
    existing = connection.execute(select_stmt).mappings().first()

    if existing is None:
        _execute_insert(connection, table, final_payload, natural_key_cols)
        return "insert", []

    changed_fields = _diff(existing, final_payload, natural_key_cols)
    if not changed_fields:
        return "skip", []

    _execute_update(connection, table, final_payload, natural_key_cols, existing)
    return "update", changed_fields


def _resolve_empresa_id(
    connection: Connection,
    empresas_table: sa.Table,
    cache: Dict[str, int],
    cnpj: Optional[str],
) -> Optional[int]:
    normalized = only_digits(cnpj)
    if not normalized:
        return None
    if normalized in cache:
        return cache[normalized]
    result = connection.execute(
        sa.select(empresas_table.c.id).where(empresas_table.c.cnpj == normalized)
    ).scalar()
    if result is None:
        raise ValueError(f"Empresa com CNPJ {normalized} não encontrada")
    cache[normalized] = result
    return result


def _build_natural_key(
    table_name: str,
    table: sa.Table,
    payload: Dict[str, Any],
    empresa_id: Optional[int],
) -> tuple[sa.Select, Sequence[str]]:
    if table_name == "empresas":
        cols = (table.c.cnpj,)
        where_clause = table.c.cnpj == payload["cnpj"]
        return sa.select(table).where(where_clause), ("cnpj",)
    if table_name in {"licencas", "taxas"}:
        cols = (table.c.empresa_id, table.c.tipo)
        where_clause = sa.and_(
            table.c.empresa_id == payload["empresa_id"],
            table.c.tipo == payload["tipo"],
        )
        return sa.select(table).where(where_clause), ("empresa_id", "tipo")
    if table_name == "processos":
        protocolo = payload.get("protocolo")
        if protocolo:
            where_clause = sa.and_(
                table.c.protocolo == protocolo,
                table.c.tipo == payload["tipo"],
            )
            return sa.select(table).where(where_clause), ("protocolo", "tipo")
        where_clause = sa.and_(
            table.c.empresa_id == payload["empresa_id"],
            table.c.tipo == payload["tipo"],
            table.c.data_solicitacao == payload["data_solicitacao"],
        )
        return sa.select(table).where(where_clause), ("empresa_id", "tipo", "data_solicitacao")
    raise ValueError(f"Tabela não suportada: {table_name}")


def _execute_insert(
    connection: Connection,
    table: sa.Table,
    payload: Dict[str, Any],
    natural_key_cols: Sequence[str],
) -> None:
    if connection.dialect.name == "postgresql":
        stmt = postgresql.insert(table).values(**payload)
        update_columns = {col: getattr(stmt.excluded, col) for col in payload.keys() if col not in natural_key_cols}
        if update_columns:
            where_clause = sa.or_(
                table.c[col].is_distinct_from(getattr(stmt.excluded, col)) for col in update_columns
            )
        else:
            where_clause = None
        stmt = stmt.on_conflict_do_update(
            index_elements=[table.c[col] for col in natural_key_cols],
            set_=update_columns,
            where=where_clause,
        )
        connection.execute(stmt)
    else:
        connection.execute(table.insert().values(**payload))


def _execute_update(
    connection: Connection,
    table: sa.Table,
    payload: Dict[str, Any],
    natural_key_cols: Sequence[str],
    existing: sa.RowMapping,
) -> None:
    where_clause = sa.and_(
        *[table.c[col] == existing[col] for col in natural_key_cols]
    )
    connection.execute(table.update().where(where_clause).values(**payload))


def _diff(existing: sa.RowMapping, payload: Dict[str, Any], natural_key_cols: Sequence[str]) -> List[str]:
    changed: List[str] = []
    for key, value in payload.items():
        if key in natural_key_cols:
            continue
        if existing.get(key) != value:
            changed.append(key)
    return changed
