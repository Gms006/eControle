from __future__ import annotations

import uuid

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.notification_event import NotificationEvent
from app.models.notification_operational_scan_run import NotificationOperationalScanRun
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def _login(client, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _get_me(client, token: str) -> dict:
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.json()


def _create_view_user(org_id: str) -> tuple[str, str]:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        assert role is not None
        suffix = uuid.uuid4().hex[:8]
        email = f"view-notif-{suffix}@example.com"
        password = "view123"
        user = User(
            email=email,
            hashed_password=hash_password(password),
            org_id=org_id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
        return email, password
    finally:
        db.close()


def _insert_notification(
    *,
    org_id: str,
    title: str,
    dedupe_key: str,
    read: bool = False,
) -> str:
    db = SessionLocal()
    try:
        event = NotificationEvent(
            org_id=org_id,
            event_type="job.test.finished",
            severity="info",
            title=title,
            message=f"Mensagem {title}",
            route_path="/painel?tab=taxas",
            dedupe_key=dedupe_key,
        )
        if read:
            from datetime import datetime, timezone

            event.read_at = datetime.now(timezone.utc)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event.id
    finally:
        db.close()


def test_notifications_endpoints_enforce_org_isolation_and_unread_count(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]

    db = SessionLocal()
    other_org = Org(name="Other Org Notifications", slug=f"other-org-notif-{uuid.uuid4().hex[:6]}")
    db.add(other_org)
    db.commit()
    db.refresh(other_org)
    db.close()

    my_unread_id = _insert_notification(org_id=org_id, title="Minha 1", dedupe_key="notif:my:1", read=False)
    _insert_notification(org_id=org_id, title="Minha 2 lida", dedupe_key="notif:my:2", read=True)
    foreign_id = _insert_notification(org_id=other_org.id, title="Outra org", dedupe_key="notif:other:1", read=False)

    headers = {"Authorization": f"Bearer {admin_token}"}

    listing = client.get("/api/v1/notificacoes?limit=10&offset=0", headers=headers)
    assert listing.status_code == 200
    payload = listing.json()
    ids = {item["id"] for item in payload["items"]}
    assert my_unread_id in ids
    assert foreign_id not in ids
    assert payload["total"] >= 2

    unread = client.get("/api/v1/notificacoes/unread-count", headers=headers)
    assert unread.status_code == 200
    assert unread.json()["unread_count"] == 1

    read_response = client.post(f"/api/v1/notificacoes/{my_unread_id}/read", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json()["id"] == my_unread_id
    assert read_response.json()["read_at"] is not None

    unread_after = client.get("/api/v1/notificacoes/unread-count", headers=headers)
    assert unread_after.status_code == 200
    assert unread_after.json()["unread_count"] == 0

    foreign_read = client.post(f"/api/v1/notificacoes/{foreign_id}/read", headers=headers)
    assert foreign_read.status_code == 404


def test_view_role_can_list_and_mark_notifications_as_read(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]

    event_id = _insert_notification(
        org_id=org_id,
        title="Evento para VIEW",
        dedupe_key=f"notif:view:{uuid.uuid4().hex[:8]}",
        read=False,
    )
    email, password = _create_view_user(org_id)
    view_token = _login(client, email, password)
    headers = {"Authorization": f"Bearer {view_token}"}

    list_response = client.get("/api/v1/notificacoes", headers=headers)
    assert list_response.status_code == 200
    assert any(item["id"] == event_id for item in list_response.json()["items"])

    mark_read = client.post(f"/api/v1/notificacoes/{event_id}/read", headers=headers)
    assert mark_read.status_code == 200
    assert mark_read.json()["read_at"] is not None


def test_operational_scan_endpoint_requires_admin_or_dev_and_integrates_worker_jobs(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]
    view_email, view_password = _create_view_user(org_id)
    view_token = _login(client, view_email, view_password)

    view_response = client.post(
        "/api/v1/notificacoes/scan-operacional",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert view_response.status_code == 403

    start_response = client.post(
        "/api/v1/notificacoes/scan-operacional",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert start_response.status_code == 200
    run_id = start_response.json()["run_id"]

    db = SessionLocal()
    try:
        run = db.query(NotificationOperationalScanRun).filter(NotificationOperationalScanRun.id == run_id).first()
        assert run is not None
        assert run.org_id == org_id
    finally:
        db.close()

    worker_response = client.get(
        f"/api/v1/worker/jobs/{run_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert worker_response.status_code == 200
    payload = worker_response.json()
    assert payload["job_type"] == "notification_operational_scan"
    assert payload["source"] == "notification_operational_scan_runs"
