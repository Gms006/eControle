from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import ensure_positive_pagination
from app.core.config import settings
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.uteis import (
    Contato,
    ContatoListResponse,
    Modelo,
    ModeloListResponse,
    RequerimentoFile,
    RequerimentoListResponse,
)
from app.services.file_browse import decode_id_to_path, file_info, iter_files

router = APIRouter(prefix="/uteis", tags=["Úteis"])


def _paginate_items(items: list[dict[str, object]], page: int, size: int) -> tuple[list[dict[str, object]], int]:
    start = (page - 1) * size
    end = start + size
    return items[start:end], len(items)


@router.get("/requerimentos", response_model=RequerimentoListResponse)
def listar_requerimentos(
    q: Optional[str] = Query(None, description="Busca por nome ou caminho"),
    tipo: Optional[str] = Query(None),
    municipio: Optional[str] = Query(None),
    sort: Optional[str] = Query("-mtime", description="nome ou -mtime"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    _: User = Depends(require_role(Role.VIEWER)),
) -> RequerimentoListResponse:
    page, size = ensure_positive_pagination(page, size, max_size=200)

    root = Path(settings.uteis_req_root)
    if not root.exists() or not root.is_dir():
        return RequerimentoListResponse(items=[], total=0, page=page, size=size)

    allowed_exts = settings.uteis_allowed_exts
    max_depth = settings.uteis_req_max_depth
    resolved_root = root.resolve()

    rows = [
        file_info(resolved_root, path)
        for path in iter_files(resolved_root, allowed_exts=allowed_exts, max_depth=max_depth)
    ]

    if tipo:
        rows = [row for row in rows if (row.get("tipo") or "").lower() == tipo.lower()]
    if municipio:
        rows = [row for row in rows if (row.get("municipio") or "").lower() == municipio.lower()]
    if q:
        query_lower = q.lower()
        rows = [
            row
            for row in rows
            if query_lower in row["nome"].lower() or query_lower in row["relpath"].lower()
        ]

    if sort == "nome":
        rows.sort(key=lambda row: (row["nome"].lower(), row["relpath"].lower()))
    elif sort == "-nome":
        rows.sort(key=lambda row: (row["nome"].lower(), row["relpath"].lower()), reverse=True)
    else:
        rows.sort(key=lambda row: row["mtime"], reverse=sort != "mtime")

    page_items, total = _paginate_items(rows, page, size)
    return RequerimentoListResponse(
        items=[RequerimentoFile(**item) for item in page_items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/requerimentos/download/{file_id}")
def download_requerimento(
    file_id: str,
    inline: bool = Query(False, description="Definir Content-Disposition como inline"),
    _: User = Depends(require_role(Role.VIEWER)),
):
    root = Path(settings.uteis_req_root)
    try:
        path = decode_id_to_path(root, file_id)
    except PermissionError as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Arquivo não encontrado") from exc

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    headers = {}
    if inline:
        headers["Content-Disposition"] = f'inline; filename="{path.name}"'
    return FileResponse(path, filename=path.name, headers=headers)


@router.get("/contatos", response_model=ContatoListResponse)
def listar_contatos(
    municipio: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Busca por contato ou e-mail"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> ContatoListResponse:
    page, size = ensure_positive_pagination(page, size, max_size=200)

    filters = ["1=1"]
    params: dict[str, object] = {}
    if municipio:
        filters.append("LOWER(municipio) = LOWER(:municipio)")
        params["municipio"] = municipio
    if categoria:
        filters.append("categoria = :categoria")
        params["categoria"] = categoria
    if q:
        filters.append("(contato ILIKE :q OR COALESCE(email, '') ILIKE :q)")
        params["q"] = f"%{q}%"

    where_clause = " AND ".join(filters)
    total = db.execute(text(f"SELECT COUNT(*) FROM contatos WHERE {where_clause}"), params).scalar_one()

    query = text(
        f"""
        SELECT id, contato, municipio, telefone, whatsapp, email, categoria
        FROM contatos
        WHERE {where_clause}
        ORDER BY contato ASC
        LIMIT :limit OFFSET :offset
        """
    )
    rows = db.execute(query, {**params, "limit": size, "offset": (page - 1) * size}).mappings().all()

    items = [
        Contato(
            id=row["id"],
            contato=row["contato"],
            municipio=row["municipio"],
            telefone=row["telefone"],
            whatsapp=row["whatsapp"],
            e_mail=row["email"],
            categoria=row["categoria"],
        )
        for row in rows
    ]
    return ContatoListResponse(items=items, total=total, page=page, size=size)


@router.get("/modelos", response_model=ModeloListResponse)
def listar_modelos(
    q: Optional[str] = Query(None, description="Busca por modelo ou descrição"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> ModeloListResponse:
    page, size = ensure_positive_pagination(page, size, max_size=200)

    filters = ["1=1"]
    params: dict[str, object] = {}
    if q:
        filters.append("(modelo ILIKE :q OR COALESCE(descricao, '') ILIKE :q)")
        params["q"] = f"%{q}%"

    where_clause = " AND ".join(filters)
    try:
        total_stmt = text(f"SELECT COUNT(*) FROM modelos WHERE {where_clause}")
        total = db.execute(total_stmt, params).scalar_one()

        query = text(
            f"""
            SELECT id, modelo, descricao, utilizacao
            FROM modelos
            WHERE {where_clause}
            ORDER BY modelo ASC
            LIMIT :limit OFFSET :offset
            """
        )
        rows = db.execute(query, {**params, "limit": size, "offset": (page - 1) * size}).mappings().all()
    except Exception:  # noqa: BLE001
        return ModeloListResponse(items=[], total=0, page=page, size=size)

    items = [
        Modelo(
            id=row["id"],
            modelo=row["modelo"],
            descricao=row["descricao"],
            utilizacao=row["utilizacao"],
        )
        for row in rows
    ]
    return ModeloListResponse(items=items, total=total, page=page, size=size)
