from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import cast, or_, select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session
from sqlalchemy.types import String

from app.deps.auth import Role, User, db_with_org, require_role
from db.models_sql import Contato, Modelo

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
    org_id: UUID,
) -> list[dict[str, object]]:
    categoria_text = cast(Contato.categoria, String)
    stmt = (
        select(
            Contato.id,
            Contato.contato.label("contato"),
            Contato.municipio,
            Contato.telefone,
            Contato.whatsapp,
            Contato.email,
            categoria_text.label("categoria"),
            Contato.created_at,
            Contato.updated_at,
        )
        .where(Contato.org_id == org_id)
    )

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Contato.contato.ilike(pattern),
                Contato.email.ilike(pattern),
                Contato.telefone.ilike(pattern),
                Contato.municipio.ilike(pattern),
                Contato.whatsapp.ilike(pattern),
            )
        )

    if categoria:
        stmt = stmt.where(Contato.categoria == categoria)

    stmt = stmt.order_by(categoria_text, Contato.contato)

    return [dict(row) for row in db.execute(stmt).mappings().all()]


def _listar_modelos_base(
    db: Session,
    search: str | None,
    utilizacao: str | None,
    org_id: UUID,
) -> list[dict[str, object]]:
    stmt = (
        select(
            Modelo.id,
            Modelo.modelo.label("modelo"),
            Modelo.descricao.label("descricao"),
            Modelo.utilizacao.label("utilizacao"),
            Modelo.created_at,
            Modelo.updated_at,
        )
        .where(Modelo.org_id == org_id)
    )

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Modelo.modelo.ilike(pattern),
                Modelo.descricao.ilike(pattern),
            )
        )

    if utilizacao:
        stmt = stmt.where(Modelo.utilizacao == utilizacao)

    stmt = stmt.order_by(Modelo.utilizacao, Modelo.modelo)

    return [dict(row) for row in db.execute(stmt).mappings().all()]


@router.get("")
def listar_uteis(
    search: str | None = Query(None, description="Texto para filtrar contatos e modelos."),
    categoria: str | None = Query(None, description="Filtrar contatos por categoria."),
    utilizacao: str | None = Query(None, description="Filtrar modelos pela utilização."),
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.VIEWER)),
):
    org_id = user.org_id

    contatos: list[dict[str, object]] = []
    if _relation_exists(db, "v_contatos_uteis"):
        filtros_contatos: list[str] = ["org_id = :org_id"]
        params_contatos: dict[str, object] = {"org_id": org_id}

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
            filtros_contatos.append(
                "categoria = CAST(:categoria AS categoria_contato_enum)"
            )

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
                db.rollback()
                contatos = _listar_contatos_base(db, search, categoria, org_id)
            else:  # pragma: no cover - propagates unexpected SQL errors
                raise
    elif _relation_exists(db, "contatos"):
        contatos = _listar_contatos_base(db, search, categoria, org_id)

    modelos: list[dict[str, object]] = []
    if _relation_exists(db, "v_modelos_uteis"):
        filtros_modelos: list[str] = ["org_id = :org_id"]
        params_modelos: dict[str, object] = {"org_id": org_id}

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
                db.rollback()
                modelos = _listar_modelos_base(db, search, utilizacao, org_id)
            else:  # pragma: no cover - unexpected SQL errors
                raise
    elif _relation_exists(db, "modelos"):
        modelos = _listar_modelos_base(db, search, utilizacao, org_id)

    return {"contatos": contatos, "modelos": modelos}
