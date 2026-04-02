from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.notification_event import NotificationEvent
from app.models.notification_operational_scan_run import NotificationOperationalScanRun
from app.models.org import Org
from app.models.user import User
from app.schemas.notification import (
    NotificationEventOut,
    NotificationListResponse,
    NotificationOperationalScanStartResponse,
    NotificationReadResponse,
    NotificationUnreadCountResponse,
)
from app.services.notification_operational_scan import run_notification_operational_scan_job
from app.services.notifications import mark_notification_as_read


router = APIRouter()


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> NotificationListResponse:
    base_query = db.query(NotificationEvent).filter(NotificationEvent.org_id == org.id)
    total = int(base_query.count())
    rows = (
        base_query.order_by(NotificationEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return NotificationListResponse(
        items=[NotificationEventOut.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> NotificationUnreadCountResponse:
    unread_count = (
        db.query(func.count(NotificationEvent.id))
        .filter(
            NotificationEvent.org_id == org.id,
            NotificationEvent.read_at.is_(None),
        )
        .scalar()
        or 0
    )
    return NotificationUnreadCountResponse(unread_count=int(unread_count))


@router.post("/{notification_id}/read", response_model=NotificationReadResponse)
def read_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> NotificationReadResponse:
    event = (
        db.query(NotificationEvent)
        .filter(
            NotificationEvent.id == notification_id,
            NotificationEvent.org_id == org.id,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    event = mark_notification_as_read(db, event)
    return NotificationReadResponse(id=event.id, read_at=event.read_at)


@router.post("/scan-operacional", response_model=NotificationOperationalScanStartResponse)
def run_operational_scan(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> NotificationOperationalScanStartResponse:
    active_run = (
        db.query(NotificationOperationalScanRun)
        .filter(
            NotificationOperationalScanRun.org_id == org.id,
            NotificationOperationalScanRun.status.in_(["queued", "running"]),
        )
        .order_by(NotificationOperationalScanRun.started_at.desc())
        .first()
    )
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "There is already an active operational scan", "run_id": active_run.id},
        )

    run = NotificationOperationalScanRun(
        org_id=org.id,
        started_by_user_id=user.id,
        status="queued",
        total=0,
        processed=0,
        emitted_count=0,
        deduped_count=0,
        error_count=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(run_notification_operational_scan_job, run.id)
    return NotificationOperationalScanStartResponse(run_id=run.id, status=run.status)
