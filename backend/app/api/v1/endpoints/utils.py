from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session


def resolve_sort(sort: str | None, allowed: Dict[str, str], default: str) -> Tuple[str, str]:
    direction = "ASC"
    key = sort or default
    if key.startswith("-"):
        direction = "DESC"
        key = key[1:]
    if key not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Campo de ordenação inválido: {key}")
    return allowed[key], direction


def paginate_query(
    db: Session,
    base_query: str,
    params: Dict[str, Any],
    sort_expression: str,
    direction: str,
    page: int,
    size: int,
) -> Dict[str, Any]:
    offset = (page - 1) * size
    count_sql = f"SELECT COUNT(*) FROM ({base_query}) subquery"
    total = db.execute(text(count_sql), params).scalar_one()
    query_sql = f"{base_query} ORDER BY {sort_expression} {direction} LIMIT :limit OFFSET :offset"
    result = db.execute(text(query_sql), {**params, "limit": size, "offset": offset})
    items = [dict(row) for row in result.mappings().all()]
    return {"items": items, "total": total, "page": page, "size": size}


def ensure_positive_pagination(page: int, size: int, max_size: int = 2000) -> Tuple[int, int]:
    if page < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="page deve ser >= 1")
    if size < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="size deve ser >= 1")
    if size > max_size:
        size = max_size
    return page, size


def build_where_clause(filters: Iterable[str]) -> str:
    clauses = [clause for clause in filters if clause]
    if not clauses:
        return ""
    return " WHERE " + " AND ".join(clauses)
