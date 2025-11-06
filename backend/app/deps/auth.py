from __future__ import annotations

from enum import Enum

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

auth_scheme = HTTPBearer()


class Role(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    VIEWER = "VIEWER"


class User(BaseModel):
    id: int
    org_id: str
    email: str
    role: Role


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> User:
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc
    for key in ("sub", "org_id", "email", "role"):
        if key not in payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Claim ausente: {key}")
    return User(
        id=int(payload["sub"]),
        org_id=str(payload["org_id"]),
        email=str(payload["email"]),
        role=Role(payload["role"]),
    )


def require_role(min_role: Role):
    order = {Role.VIEWER: 1, Role.STAFF: 2, Role.ADMIN: 3, Role.OWNER: 4}

    def _inner(user: User = Depends(get_current_user)) -> User:
        if order[user.role] < order[min_role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
        return user

    return _inner


def db_with_org(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Session:
    dialect_name = db.bind.dialect.name if db.bind is not None else ""
    if dialect_name != "postgresql":
        return db
    try:
        db.execute(text("SET app.current_org = :org"), {"org": user.org_id})
    except (ProgrammingError, OperationalError) as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Contexto de organização indisponível") from exc
    return db
