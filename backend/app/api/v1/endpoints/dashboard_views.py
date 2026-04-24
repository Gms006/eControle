from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.dashboard_saved_view import DashboardSavedView
from app.models.org import Org
from app.models.user import User
from app.schemas.dashboard_saved_view import (
    DashboardSavedViewCreate,
    DashboardSavedViewListResponse,
    DashboardSavedViewOut,
    DashboardSavedViewUpdate,
)


router = APIRouter()


def _user_role_names(user: User) -> set[str]:
    return {role.name for role in user.roles}


def _can_manage_shared(user: User) -> bool:
    return bool(_user_role_names(user).intersection({"ADMIN", "DEV"}))


def _can_manage_view_entry(entry: DashboardSavedView, user: User) -> bool:
    if entry.scope == "shared":
        return _can_manage_shared(user)
    return entry.created_by_user_id == user.id


@router.get("/views", response_model=DashboardSavedViewListResponse)
def list_dashboard_views(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
    tab_key: str = Query(default="painel", min_length=1, max_length=32),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> DashboardSavedViewListResponse:
    base_query = (
        db.query(DashboardSavedView)
        .filter(
            DashboardSavedView.org_id == org.id,
            DashboardSavedView.tab_key == tab_key,
            or_(
                DashboardSavedView.scope == "shared",
                DashboardSavedView.created_by_user_id == user.id,
            ),
        )
    )
    total = int(base_query.count())
    rows = (
        base_query.order_by(
            DashboardSavedView.is_pinned.desc(),
            DashboardSavedView.updated_at.desc(),
            DashboardSavedView.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    return DashboardSavedViewListResponse(
        items=[DashboardSavedViewOut.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/views", response_model=DashboardSavedViewOut, status_code=status.HTTP_201_CREATED)
def create_dashboard_view(
    payload: DashboardSavedViewCreate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> DashboardSavedViewOut:
    if payload.scope == "shared" and not _can_manage_shared(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    entry = DashboardSavedView(
        org_id=org.id,
        created_by_user_id=user.id,
        name=payload.name.strip(),
        tab_key=payload.tab_key.strip() or "painel",
        scope=payload.scope,
        payload_json=payload.payload_json or {},
        is_pinned=bool(payload.is_pinned),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return DashboardSavedViewOut.model_validate(entry)


@router.patch("/views/{view_id}", response_model=DashboardSavedViewOut)
def update_dashboard_view(
    view_id: str,
    payload: DashboardSavedViewUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> DashboardSavedViewOut:
    entry = (
        db.query(DashboardSavedView)
        .filter(DashboardSavedView.id == view_id, DashboardSavedView.org_id == org.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard view not found")
    if not _can_manage_view_entry(entry, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    patch = payload.model_dump(exclude_unset=True)
    if "scope" in patch and patch["scope"] == "shared" and not _can_manage_shared(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if "name" in patch and patch["name"] is not None:
        entry.name = patch["name"].strip()
    if "scope" in patch and patch["scope"] is not None:
        entry.scope = patch["scope"]
    if "payload_json" in patch and patch["payload_json"] is not None:
        entry.payload_json = patch["payload_json"]
    if "is_pinned" in patch and patch["is_pinned"] is not None:
        entry.is_pinned = bool(patch["is_pinned"])

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return DashboardSavedViewOut.model_validate(entry)


@router.delete("/views/{view_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_dashboard_view(
    view_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> Response:
    entry = (
        db.query(DashboardSavedView)
        .filter(DashboardSavedView.id == view_id, DashboardSavedView.org_id == org.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard view not found")
    if not _can_manage_view_entry(entry, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
