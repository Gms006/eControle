from __future__ import annotations

from enum import Enum
from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

bearer = HTTPBearer(auto_error=True)


class Role(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    VIEWER = "VIEWER"


class User(BaseModel):
    id: int
    org_id: UUID
    email: EmailStr
    role: Role


def get_current_user(creds: HTTPAuthorizationCredentials = Security(bearer)) -> User:
    token = creds.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    sub = payload.get("sub")
    org_id = payload.get("org_id")
    email = payload.get("email")
    role_value = payload.get("role", Role.VIEWER.value)

    if not sub or not org_id:
        raise HTTPException(status_code=401, detail="Token sem sub/org_id")

    try:
        role = Role(role_value)
    except ValueError:
        role = Role.VIEWER

    try:
        user_id = int(sub)
        org_uuid = UUID(str(org_id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    return User(id=user_id, org_id=org_uuid, email=email, role=role)


def require_role(min_role: Role) -> Callable[[User], User]:
    hierarchy = {Role.OWNER: 3, Role.ADMIN: 2, Role.STAFF: 1, Role.VIEWER: 0}

    def _dep(user: User = Depends(get_current_user)) -> User:
        if hierarchy[user.role] < hierarchy[min_role]:
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return user

    return _dep


def db_with_org(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.VIEWER)),
) -> Session:
    try:
        db.execute(text("SET LOCAL app.current_org = :org_id"), {"org_id": str(user.org_id)})
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Contexto de organização indisponível") from exc
    return db
