from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db

router = APIRouter(prefix="/uteis", tags=["Uteis"])


def _table_exists(db: Session, name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = :t
                LIMIT 1
                """
            ),
            {"t": name},
        ).scalar()
    )


@router.get("")
def listar_uteis(db: Session = Depends(get_db)):
    contatos = []
    if _table_exists(db, "contatos"):
        contatos = [
            dict(row)
            for row in db.execute(
                text(
                    """
                    SELECT id, contato, municipio, telefone, whatsapp, email, categoria
                    FROM contatos
                    ORDER BY categoria, contato
                    """
                )
            ).mappings().all()
        ]

    modelos = []
    if _table_exists(db, "modelos"):
        modelos = [
            dict(row)
            for row in db.execute(
                text(
                    """
                    SELECT id, modelo, descricao, utilizacao
                    FROM modelos
                    ORDER BY utilizacao, descricao
                    """
                )
            ).mappings().all()
        ]

    return {"contatos": contatos, "modelos": modelos}
