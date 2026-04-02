from __future__ import annotations

from app.db.session import SessionLocal
from app.models.notification_event import NotificationEvent
from app.models.org import Org
from app.services.notifications import emit_org_notification


def _count_for_org(db, org_id: str) -> int:
    return db.query(NotificationEvent).filter(NotificationEvent.org_id == org_id).count()


def test_emit_org_notification_dedupes_by_org_and_dedupe_key(client):
    db = SessionLocal()
    try:
        base_org = db.query(Org).first()
        assert base_org is not None

        other_org = Org(name="Org Notification Test", slug="org-notif-test")
        db.add(other_org)
        db.commit()
        db.refresh(other_org)

        emit_org_notification(
            db,
            org_id=base_org.id,
            event_type="job.test.finished",
            severity="info",
            title="Run concluida",
            message="Primeira emissao",
            dedupe_key="job:test:run-1:completed",
            commit=True,
        )
        emit_org_notification(
            db,
            org_id=base_org.id,
            event_type="job.test.finished",
            severity="info",
            title="Run concluida",
            message="Reemissao",
            dedupe_key="job:test:run-1:completed",
            commit=True,
        )
        emit_org_notification(
            db,
            org_id=other_org.id,
            event_type="job.test.finished",
            severity="info",
            title="Run concluida",
            message="Mesmo dedupe em outra org",
            dedupe_key="job:test:run-1:completed",
            commit=True,
        )

        assert _count_for_org(db, base_org.id) == 1
        assert _count_for_org(db, other_org.id) == 1
    finally:
        db.close()
