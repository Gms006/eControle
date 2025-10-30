"""Load step: writes staging rows and performs idempotent upserts."""
from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection, Engine

from .normalizers import make_row_hash, only_digits
from .transform_normalize import NormalizedRow

FINAL_TABLES = {"empresas", "licencas", "taxas", "processos", "processos_avulsos"}

def _coerce_jsonable(obj: Any) -> Any:
    """Converte objetos (date, Decimal, etc.) para tipos serializáveis em JSON.
    Estratégia: json.dumps(default=str) e volta com json.loads para obter um dict/list primitivo."""
    return json.loads(json.dumps(obj, ensure_ascii=False, default=str))

def run(
    engine: Engine,
    normalized: Dict[str, List[NormalizedRow]],
    run_id: str,
    file_source: str,
    dry_run: bool = True,
) -> List[Dict[str, Any]]:
    with _transaction(engine, dry_run) as connection:
        metadata = sa.MetaData()
        inspector = sa.inspect(connection)
        available_tables = set(inspector.get_table_names())

        required_tables = {"empresas", "licencas", "taxas", "processos"}
        missing_required = required_tables - available_tables
        if missing_required:
            raise ValueError(f"Tabelas obrigatórias ausentes: {', '.join(sorted(missing_required))}")

        optional_tables = {
            "processos_avulsos",
            "stg_processos_avulsos",
        }
        tables_to_reflect = list(required_tables | optional_tables | {
            "stg_empresas",
            "stg_licencas",
            "stg_taxas",
            "stg_processos",
            "stg_certificados",
            "stg_certificados_agendamentos",
        })
        metadata.reflect(
            connection,
            only=[name for name in tables_to_reflect if name in available_tables],
        )
        empresas_table = metadata.tables["empresas"]
        staging_tables = {
            name: metadata.tables[name]
            for name in (
                "stg_empresas",
                "stg_licencas",
                "stg_taxas",
                "stg_processos",
                "stg_processos_avulsos",
                "stg_certificados",
                "stg_certificados_agendamentos",
            )
            if name in metadata.tables
        }
        results: List[Dict[str, Any]] = []
        empresa_cache: Dict[str, int] = {}

        ordered_tables = [
            "empresas",
            "licencas",
            "taxas",
            "processos",
            "processos_avulsos",
            "certificados",
            "certificados_agendamentos",
        ]
        for table in ordered_tables:
            rows = normalized.get(table, [])
            for item in rows:
                stg_name = f"stg_{'processos_avulsos' if (table == 'processos' and _is_avulso(item.payload)) else table}"
                if stg_name not in staging_tables:
                    raise ValueError(f"Tabela de staging '{stg_name}' não encontrada")
                staging_table = staging_tables[stg_name]
                payload = dict(item.payload)
                # coerção para JSON determinístico (datas → "YYYY-MM-DD", etc.)
                payload_coerced = _coerce_jsonable(payload)
                payload_json = json.dumps(payload_coerced, sort_keys=True, ensure_ascii=False)
                row_hash = make_row_hash(item.table, item.row_number, payload_json)
                _insert_staging(
                    connection,
                    staging_table,
                    run_id,
                    file_source,
                    item.row_number,
                    row_hash,
                    payload_coerced,
                )
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
                    metadata.tables.get("processos_avulsos"),
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
    # payload já está coerced em tipos primitivos (dict/list/str/num/bool/None)
    value = payload
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
    processos_avulsos_table: Optional[sa.Table] = None,
) -> tuple[str, List[str]]:
    final_payload = dict(payload)
    if table_name != "empresas":
        cnpj_norm = only_digits(final_payload.get("empresa_cnpj"))
        if table_name == "processos" and (not cnpj_norm or len(cnpj_norm) not in (11, 14)):
            return _upsert_processos_avulsos(connection, processos_avulsos_table, final_payload)
        empresa_id = _resolve_empresa_id(connection, empresas_table, empresa_cache, cnpj_norm)
        if not empresa_id:
            if table_name == "processos" and processos_avulsos_table is not None:
                return _upsert_processos_avulsos(connection, processos_avulsos_table, final_payload)
            raise ValueError(
                f"Empresa não encontrada para documento {final_payload.get('empresa_cnpj')}"
            )
        final_payload["empresa_id"] = empresa_id
        final_payload.pop("empresa_cnpj", None)
        final_payload.pop("empresa_nome", None)
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
        return None
    cache[normalized] = result
    return result


def _upsert_processos_avulsos(
    connection: Connection,
    table: Optional[sa.Table],
    payload: Dict[str, Any],
) -> tuple[str, List[str]]:
    if table is None:
        raise ValueError("Tabela processos_avulsos não configurada na base")

    final_payload = dict(payload)
    documento = only_digits(final_payload.get("empresa_cnpj"))
    final_payload["documento"] = documento or final_payload.get("empresa_cnpj")
    final_payload.pop("empresa_cnpj", None)

    select_stmt, natural_key_cols = _build_natural_key(
        "processos_avulsos",
        table,
        final_payload,
        None,
    )
    existing = connection.execute(select_stmt).mappings().first()

    if existing is None:
        _execute_insert(connection, table, final_payload, natural_key_cols)
        return "insert", []

    changed_fields = _diff(existing, final_payload, natural_key_cols)
    if not changed_fields:
        return "skip", []

    _execute_update(connection, table, final_payload, natural_key_cols, existing)
    return "update", changed_fields


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
    if table_name == "taxas":
        if "data_referencia" in table.c and payload.get("data_referencia"):
            where_clause = sa.and_(
                table.c.empresa_id == payload["empresa_id"],
                table.c.tipo == payload["tipo"],
                table.c.data_referencia == payload["data_referencia"],
            )
            return sa.select(table).where(where_clause), (
                "empresa_id",
                "tipo",
                "data_referencia",
            )
        where_clause = sa.and_(
            table.c.empresa_id == payload["empresa_id"],
            table.c.tipo == payload["tipo"],
        )
        return sa.select(table).where(where_clause), ("empresa_id", "tipo")
    if table_name == "licencas":
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
        data_ref = payload.get("data_solicitacao")
        if data_ref:
            # sem protocolo, com data → (empresa_id, tipo, data_solicitacao)
            where_clause = sa.and_(
                table.c.empresa_id == payload["empresa_id"],
                table.c.tipo == payload["tipo"],
                table.c.data_solicitacao == data_ref,
            )
            return sa.select(table).where(where_clause), ("empresa_id", "tipo", "data_solicitacao")
        # sem protocolo E sem data → (empresa_id, tipo) + guardas de NULL na busca
        where_clause = sa.and_(
            table.c.empresa_id == payload["empresa_id"],
            table.c.tipo == payload["tipo"],
            table.c.protocolo.is_(None),
            table.c.data_solicitacao.is_(None),
        )
        # Natural key usada no ON CONFLICT: (empresa_id, tipo)
        # Isso exige a unique parcial criada na migration 04.
        return sa.select(table).where(where_clause), ("empresa_id", "tipo")
    if table_name == "processos_avulsos":
        protocolo = payload.get("protocolo")
        if protocolo:
            where_clause = sa.and_(
                table.c.protocolo == protocolo,
                table.c.tipo == payload["tipo"],
            )
            return sa.select(table).where(where_clause), ("protocolo", "tipo")

        data_ref = payload.get("data_solicitacao")
        if data_ref is not None:
            where_clause = sa.and_(
                table.c.documento == payload["documento"],
                table.c.tipo == payload["tipo"],
                table.c.data_solicitacao == data_ref,
            )
            return sa.select(table).where(where_clause), (
                "documento",
                "tipo",
                "data_solicitacao",
            )

        where_clause = sa.and_(
            table.c.documento == payload["documento"],
            table.c.tipo == payload["tipo"],
            table.c.data_solicitacao.is_(None),
        )
        return sa.select(table).where(where_clause), ("documento", "tipo")
    raise ValueError(f"Tabela não suportada: {table_name}")


def _execute_insert(
    connection: Connection,
    table: sa.Table,
    payload: Dict[str, Any],
    natural_key_cols: Sequence[str],
) -> None:
    if connection.dialect.name == "postgresql":
        stmt = postgresql.insert(table).values(**payload)
        update_columns = {
            col: getattr(stmt.excluded, col)
            for col in payload.keys()
            if col not in natural_key_cols
        }
        where_clause = (
            sa.or_(
                *(table.c[col].is_distinct_from(getattr(stmt.excluded, col)) for col in update_columns)
            )
            if update_columns
            else None
        )

        if table.name == "processos_avulsos" and tuple(natural_key_cols) == ("protocolo", "tipo"):
            stmt = stmt.on_conflict_do_update(
                constraint="uq_proc_avulso_protocolo_tipo",
                set_=update_columns,
                where=where_clause,
            )
        elif table.name == "processos_avulsos" and tuple(natural_key_cols) == ("documento", "tipo"):
            stmt = stmt.on_conflict_do_update(
                index_elements=[table.c.documento, table.c.tipo],
                index_where=table.c.data_solicitacao.is_(None),
                set_=update_columns,
                where=where_clause,
            )
        elif table.name == "processos" and tuple(natural_key_cols) == (
            "empresa_id",
            "tipo",
            "data_solicitacao",
        ):
            stmt = stmt.on_conflict_do_update(
                index_elements=[
                    table.c.empresa_id,
                    table.c.tipo,
                    table.c.data_solicitacao,
                ],
                index_where=table.c.protocolo.is_(None),
                set_=update_columns,
                where=where_clause,
            )
        elif table.name == "processos" and tuple(natural_key_cols) == ("empresa_id", "tipo"):
            stmt = stmt.on_conflict_do_update(
                index_elements=[table.c.empresa_id, table.c.tipo],
                index_where=sa.and_(
                    table.c.protocolo.is_(None),
                    table.c.data_solicitacao.is_(None),
                ),
                set_=update_columns,
                where=where_clause,
            )
        else:
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


def _is_avulso(payload: Dict[str, Any]) -> bool:
    c = only_digits(payload.get("empresa_cnpj"))
    return (not c) or (len(c) not in (11, 14))
