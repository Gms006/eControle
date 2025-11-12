from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
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


@router.get("")
def listar_uteis(
    search: str | None = Query(None, description="Texto para filtrar contatos e modelos."),
    categoria: str | None = Query(None, description="Filtrar contatos por categoria."),
    utilizacao: str | None = Query(None, description="Filtrar modelos pela utilização."),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
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

        contatos = []
        for row in db.execute(query_contatos, params_contatos).mappings().all():
            registro = dict(row)
            registro["contato"] = registro.pop("nome")
            contatos.append(registro)

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

        modelos = []
        for row in db.execute(query_modelos, params_modelos).mappings().all():
            registro = dict(row)
            registro["modelo"] = registro.pop("titulo")
            registro["descricao"] = registro.pop("conteudo")
            registro["utilizacao"] = registro.pop("categoria")
            modelos.append(registro)

    return {"contatos": contatos, "modelos": modelos}
