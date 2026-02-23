from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin_users import AdminUserCreate, AdminUserOut, AdminUserUpdate

# Este import depende do repo (existe role.py na estrutura)
from app.models.role import Role  # type: ignore

router = APIRouter()


def _user_to_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        org_id=user.org_id,
        is_active=user.is_active,
        roles=[r.name for r in user.roles],
        created_at=user.created_at,
    )


def _get_roles(db: Session, names: List[str]) -> List[Role]:
    # Normaliza e valida
    norm = [n.strip().upper() for n in names if n and n.strip()]
    if not norm:
        return []

    found = db.query(Role).filter(Role.name.in_(norm)).all()
    found_names = {r.name for r in found}
    missing = [n for n in norm if n not in found_names]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown roles: {', '.join(missing)}",
        )
    return found


@router.get("", response_model=List[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None, description="Filtro simples por email (contains)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_roles("ADMIN", "DEV")),
):
    query = db.query(User).filter(User.org_id == current_user.org_id)

    if q:
        query = query.filter(User.email.ilike(f"%{q.strip()}%"))

    users = query.order_by(User.email.asc()).offset(offset).limit(limit).all()
    return [_user_to_out(u) for u in users]


@router.post("", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "DEV")),
):
    email = payload.email.strip().lower()

    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        )

    roles = _get_roles(db, payload.roles)
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        is_active=True if payload.is_active is None else payload.is_active,
        org_id=current_user.org_id,
        roles=roles,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.patch("/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "DEV")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.org_id != current_user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.is_active is not None:
        if user_id == current_user.id and payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account",
            )
        user.is_active = payload.is_active

    if payload.roles is not None:
        user.roles = _get_roles(db, payload.roles)

    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_out(user)
