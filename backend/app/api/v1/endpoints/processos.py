from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.utils import (
    build_where_clause,
    ensure_positive_pagination,
    paginate_query,
    resolve_sort,
)
from app.core.config import settings
from app.deps.auth import Role, User, db_with_org, require_role
from app.schemas.processos import ProcessoCreate, ProcessoListResponse, ProcessoUpdate, ProcessoView
from db.models_sql import Empresa, Processo

router = APIRouter(prefix="/processos", tags=["Processos"])

ALLOWED_SORTS: Dict[str, str] = {
    "empresa": "empresa",
    "tipo": "tipo",
    "situacao": "situacao",
    "status_padrao": "status_padrao",
    "prazo": "prazo",
    "data_solicitacao": "data_solicitacao",
}

VALID_SITUACOES = set(settings.get_enum_values("situacao_processos"))
VALID_OPERACOES = set(settings.get_enum_values("operacoes_diversos"))
VALID_ORGAOS = set(settings.get_enum_values("orgaos_diversos"))
VALID_ALVARAS = set(settings.get_enum_values("alvaras_funcionamento"))
VALID_SERVICOS = set(settings.get_enum_values("servicos_sanitarios"))
VALID_NOTIFICACOES = set(settings.get_enum_values("notificacoes_sanitarias"))


def _fetch_processo_view(db: Session, processo_id: int) -> ProcessoView:
    query = text("SELECT * FROM v_processos_resumo WHERE processo_id = :processo_id")
    row = db.execute(query, {"processo_id": processo_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado")
    return ProcessoView(**row)


def _validate_optional(value: str | None, accepted: set[str]) -> str | None:
    if value is None:
        return None
    if accepted and value not in accepted:
        return value  # aceitar string customizada
    return value


@router.get("", response_model=ProcessoListResponse)
def listar_processos(
    empresa_id: int | None = Query(None),
    tipo: str | None = Query(None),
    situacao: str | None = Query(None),
    status_padrao: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(2000, ge=1, le=2000),
    sort: str | None = Query(None),
    db: Session = Depends(db_with_org),
    _: User = Depends(require_role(Role.VIEWER)),
) -> ProcessoListResponse:
    page, size = ensure_positive_pagination(page, size)
    params: Dict[str, object] = {}
    filters: list[str] = []

    if empresa_id is not None:
        params["empresa_id"] = empresa_id
        filters.append("empresa_id = :empresa_id")
    if tipo:
        params["tipo"] = tipo
        filters.append("tipo = :tipo")
    if situacao:
        params["situacao"] = situacao
        filters.append("situacao = :situacao")
    if status_padrao:
        params["status_padrao"] = status_padrao
        filters.append("status_padrao = :status_padrao")

    where_clause = build_where_clause(filters)
    base_query = f"SELECT * FROM v_processos_resumo{where_clause}"
    sort_column, direction = resolve_sort(sort, ALLOWED_SORTS, "data_solicitacao")
    data = paginate_query(db, base_query, params, sort_column, direction, page, size)
    return ProcessoListResponse(**data)


@router.post("", response_model=ProcessoView, status_code=status.HTTP_201_CREATED)
def criar_processo(
    payload: ProcessoCreate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> ProcessoView:
    empresa = db.get(Empresa, payload.empresa_id)
    if not empresa or str(empresa.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

    data = payload.model_dump()
    data["situacao"] = _validate_optional(data.get("situacao"), VALID_SITUACOES)
    data["operacao"] = _validate_optional(data.get("operacao"), VALID_OPERACOES)
    data["orgao"] = _validate_optional(data.get("orgao"), VALID_ORGAOS)
    data["alvara"] = _validate_optional(data.get("alvara"), VALID_ALVARAS)
    data["servico"] = _validate_optional(data.get("servico"), VALID_SERVICOS)
    data["notificacao"] = _validate_optional(data.get("notificacao"), VALID_NOTIFICACOES)

    processo = Processo(**data)
    processo.org_id = user.org_id
    processo.created_by = user.id
    db.add(processo)
    db.commit()
    db.refresh(processo)
    return _fetch_processo_view(db, processo.id)


@router.patch("/{processo_id}", response_model=ProcessoView)
def atualizar_processo(
    processo_id: int,
    payload: ProcessoUpdate,
    db: Session = Depends(db_with_org),
    user: User = Depends(require_role(Role.ADMIN)),
) -> ProcessoView:
    processo = db.get(Processo, processo_id)
    if not processo or str(processo.org_id) != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo não encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "situacao" in data:
        data["situacao"] = _validate_optional(data.get("situacao"), VALID_SITUACOES)
    if "operacao" in data:
        data["operacao"] = _validate_optional(data.get("operacao"), VALID_OPERACOES)
    if "orgao" in data:
        data["orgao"] = _validate_optional(data.get("orgao"), VALID_ORGAOS)
    if "alvara" in data:
        data["alvara"] = _validate_optional(data.get("alvara"), VALID_ALVARAS)
    if "servico" in data:
        data["servico"] = _validate_optional(data.get("servico"), VALID_SERVICOS)
    if "notificacao" in data:
        data["notificacao"] = _validate_optional(data.get("notificacao"), VALID_NOTIFICACOES)

    for field, value in data.items():
        setattr(processo, field, value)
    processo.updated_by = user.id
    db.add(processo)
    db.commit()
    return _fetch_processo_view(db, processo.id)
