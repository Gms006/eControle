from __future__ import annotations

import logging
from enum import Enum
from typing import Callable, Generator
from uuid import UUID

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

logger = logging.getLogger(__name__)

bearer = HTTPBearer(auto_error=False)


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
    if creds is None or not creds.credentials:
        logger.warning("JWT ausente na requisição")
        raise HTTPException(status_code=401, detail="Token inválido")

    token = creds.credentials
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.encode("utf-8"),
            algorithms=[settings.jwt_alg],
            options={"verify_sub": False},  # Ignora a validação de tipo do 'sub'
        )
    except JWTError as exc:
        logger.warning(
            "Falha ao decodificar JWT: %s | alg=%s secret_fp=%s",
            exc,
            settings.jwt_alg,
            settings.jwt_secret_fingerprint,
        )
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    sub = payload.get("sub")
    org_id = payload.get("org_id")
    email = payload.get("email")
    role_value = payload.get("role", Role.VIEWER.value)

    if not sub or not org_id:
        logger.warning(
            "JWT payload incompleto: keys=%s", list(payload.keys())
        )
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        role = Role(role_value)
    except ValueError:
        role = Role.VIEWER

    try:
        user_id = int(sub)
        org_uuid = UUID(str(org_id))
    except (TypeError, ValueError) as exc:
        logger.warning("JWT payload inválido: sub=%s org_id=%s", sub, org_id)
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
) -> Generator[Session, None, None]:
    try:
        # Evita depender de transação aberta: use SET (não LOCAL)
        db.execute(text("SET app.current_org = :org_id"), {"org_id": str(user.org_id)})
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Falha ao definir app.current_org: org_id=%s err=%s",
            user.org_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Contexto de organização indisponível") from exc

    try:
        yield db
    finally:
        try:
            db.execute(text("RESET app.current_org"))
        except Exception as exc:  # noqa: BLE001
            logger.debug("RESET app.current_org falhou (safe to ignore): %s", exc)
        db.close()
