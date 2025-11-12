from __future__ import annotations

from typing import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db as _get_db
from app.deps.auth import Role, User, require_role


def get_db() -> Generator[Session, None, None]:
    """Re-export the database session dependency for API modules."""
    yield from _get_db()


def require_org(user: User = Depends(require_role(Role.VIEWER))) -> User:
    """Ensure the request is authenticated and expose organization context."""
    return user
