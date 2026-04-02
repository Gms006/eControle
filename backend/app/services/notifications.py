from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.notification_event import NotificationEvent


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def emit_org_notification(
    db: Session,
    *,
    org_id: str,
    event_type: str,
    severity: str,
    title: str,
    message: str,
    dedupe_key: str,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    route_path: str | None = None,
    metadata_json: dict[str, Any] | None = None,
    commit: bool = False,
) -> NotificationEvent:
    existing = (
        db.query(NotificationEvent)
        .filter(
            NotificationEvent.org_id == org_id,
            NotificationEvent.dedupe_key == dedupe_key,
        )
        .first()
    )
    if existing:
        return existing

    event = NotificationEvent(
        org_id=org_id,
        user_id=user_id,
        event_type=event_type,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        route_path=route_path,
        dedupe_key=dedupe_key,
        metadata_json=metadata_json,
    )
    db.add(event)

    if not commit:
        db.flush()
        return event

    try:
        db.commit()
        db.refresh(event)
        return event
    except IntegrityError:
        db.rollback()
        existing_after_conflict = (
            db.query(NotificationEvent)
            .filter(
                NotificationEvent.org_id == org_id,
                NotificationEvent.dedupe_key == dedupe_key,
            )
            .first()
        )
        if existing_after_conflict:
            return existing_after_conflict
        raise


def mark_notification_as_read(db: Session, event: NotificationEvent) -> NotificationEvent:
    if event.read_at is None:
        event.read_at = _now_utc()
        db.commit()
        db.refresh(event)
    return event
