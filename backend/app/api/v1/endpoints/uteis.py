from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.deps.auth import Role, User, db_with_org, require_role

router = APIRouter(prefix="/uteis", tags=["Uteis"])


def _relation_exists(db: Session, name: str) -> bool:
    """Return True when the given table or view exists in the public schema."""

    return bool(
        db.execute(
            text("SELECT to_regclass(:relname)"),
            {"relname": f"public.{name}"},
        ).scalar()
    )


def _is_permission_error(exc: ProgrammingError) -> bool:
    """Detecta se a exceção foi causada por falta de permissão em uma view."""

    return isinstance(exc.orig, InsufficientPrivilege) if exc.orig else False


def _listar_contatos_base(
    db: Session,
    search: str | None,
    categoria: str | None,
    org_id: str,
) -> list[dict[str, object]]:
    filtros: list[str] = ["org_id = :org_id::uuid"]
    params: dict[str, object] = {"org_id": org_id}

    if search:
        params["search"] = f"%{search}%"
        filtros.append(
            "(" "contato ILIKE :search OR "
            "coalesce(email,'') ILIKE :search OR "
            "coalesce(telefone,'') ILIKE :search OR "
            "coalesce(municipio,'') ILIKE :search OR "
            "coalesce(whatsapp,'') ILIKE :search)"
        )

    if categoria:
        params["categoria"] = categoria
        filtros.append("categoria = :categoria::categoria_contato_enum")

    where_clause = " WHERE " + " AND ".join(filtros) if filtros else ""

    query = text(
        """
        SELECT
            id,
            contato AS nome,
            municipio,
            telefone,
            whatsapp,
            email,
            categoria::text AS categoria,
            created_at,
            updated_at
        FROM contatos
        {where}
        ORDER BY categoria, contato
        """.format(where=where_clause)
    )

    registros: list[dict[str, object]] = []
    for row in db.execute(query, params).mappings().all():
        registro = dict(row)
        registro["contato"] = registro.pop("nome")
        registros.append(registro)

    return registros


def _listar_modelos_base(
    db: Session,
    search: str | None,
    utilizacao: str | None,
    org_id: str,
) -> list[dict[str, object]]:
    filtros: list[str] = ["org_id = :org_id::uuid"]
    params: dict[str, object] = {"org_id": org_id}

    if search:
        params["search"] = f"%{search}%"
        filtros.append(
            "(" "modelo ILIKE :search OR "
            "coalesce(descricao,'') ILIKE :search)"
        )

    if utilizacao:
        params["utilizacao"] = utilizacao
        filtros.append("utilizacao = :utilizacao")

    where_clause = " WHERE " + " AND ".join(filtros) if filtros else ""

    query = text(
        """
        SELECT
            id,
            modelo AS titulo,
            descricao AS conteudo,
            utilizacao AS categoria,
            created_at,
            updated_at
        FROM modelos
        {where}
        ORDER BY categoria, modelo
        """.format(where=where_clause)
    )

    registros: list[dict[str, object]] = []
    for row in db.execute(query, params).mappings().all():
        registro = dict(row)
        registro["modelo"] = registro.pop("titulo")
        registro["descricao"] = registro.pop("conteudo")
        registro["utilizacao"] = registro.pop("categoria")
        registros.append(registro)

    return registros


@router.get("")
def listar_uteis(
    search: str | None = Query(None, description="Texto para filtrar contatos e modelos."),
    categoria: str | None = Query(None, description="Filtrar contatos por categoria."),
    utilizacao: str | None = Query(None, description="Filtrar modelos pela utilização."),
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.VIEWER)),
):
    contatos: list[dict[str, object]] = []
    if _relation_exists(db, "v_contatos_uteis"):
        filtros_contatos: list[str] = []
        params_contatos: dict[str, object] = {}

        if search:
            params_contatos["search"] = f"%{search}%"
            filtros_contatos.append(
                "(nome ILIKE :search OR "
                "coalesce(email,'') ILIKE :search OR "
                "coalesce(telefone,'') ILIKE :search OR "
                "coalesce(municipio,'') ILIKE :search OR "
                "coalesce(whatsapp,'') ILIKE :search)"
            )

        if categoria:
            params_contatos["categoria"] = categoria
            filtros_contatos.append("categoria = :categoria::categoria_contato_enum")

        where_clause_contatos = ""
        if filtros_contatos:
            where_clause_contatos = " WHERE " + " AND ".join(filtros_contatos)

        query_contatos = text(
            """
            SELECT
                id,
                nome,
                municipio,
                telefone,
                whatsapp,
                email,
                categoria::text AS categoria,
                created_at,
                updated_at
            FROM v_contatos_uteis
            {where}
            ORDER BY categoria, nome
            """.format(where=where_clause_contatos)
        )

        try:
            contatos = []
            for row in db.execute(query_contatos, params_contatos).mappings().all():
                registro = dict(row)
                registro["contato"] = registro.pop("nome")
                contatos.append(registro)
        except ProgrammingError as exc:
            if _is_permission_error(exc):
                contatos = _listar_contatos_base(db, search, categoria, str(user.org_id))
            else:  # pragma: no cover - propagates unexpected SQL errors
                raise
    elif _relation_exists(db, "contatos"):
        contatos = _listar_contatos_base(db, search, categoria, str(user.org_id))

    modelos: list[dict[str, object]] = []
    if _relation_exists(db, "v_modelos_uteis"):
        filtros_modelos: list[str] = []
        params_modelos: dict[str, object] = {}

        if search:
            params_modelos["search"] = f"%{search}%"
            filtros_modelos.append(
                "(titulo ILIKE :search OR coalesce(conteudo,'') ILIKE :search)"
            )

        if utilizacao:
            params_modelos["utilizacao"] = utilizacao
            filtros_modelos.append("categoria = :utilizacao")

        where_clause_modelos = ""
        if filtros_modelos:
            where_clause_modelos = " WHERE " + " AND ".join(filtros_modelos)

        query_modelos = text(
            """
            SELECT
                id,
                titulo,
                conteudo,
                categoria,
                created_at,
                updated_at
            FROM v_modelos_uteis
            {where}
            ORDER BY categoria, titulo
            """.format(where=where_clause_modelos)
        )

        try:
            modelos = []
            for row in db.execute(query_modelos, params_modelos).mappings().all():
                registro = dict(row)
                registro["modelo"] = registro.pop("titulo")
                registro["descricao"] = registro.pop("conteudo")
                registro["utilizacao"] = registro.pop("categoria")
                modelos.append(registro)
        except ProgrammingError as exc:
            if _is_permission_error(exc):
                modelos = _listar_modelos_base(db, search, utilizacao, str(user.org_id))
            else:  # pragma: no cover - unexpected SQL errors
                raise
    elif _relation_exists(db, "modelos"):
        modelos = _listar_modelos_base(db, search, utilizacao, str(user.org_id))

    return {"contatos": contatos, "modelos": modelos}
