from __future__ import annotations

import uuid

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.dashboard_saved_view import DashboardSavedView
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


def _create_user_with_role(org_id: str, role_name: str) -> tuple[str, str]:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == role_name).first()
        assert role is not None
        suffix = uuid.uuid4().hex[:8]
        email = f"{role_name.lower()}-dash-{suffix}@example.com"
        password = "pass123"
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


def test_dashboard_views_crud_and_scope_rbac(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]

    view_email, view_password = _create_user_with_role(org_id, "VIEW")
    view_token = _login(client, view_email, view_password)

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    view_headers = {"Authorization": f"Bearer {view_token}"}

    # VIEW can create personal view
    create_personal = client.post(
        "/api/v1/dashboard/views",
        headers=view_headers,
        json={
            "name": "Minha visao",
            "tab_key": "painel",
            "scope": "personal",
            "payload_json": {"filters": {"somente_alertas": True}},
            "is_pinned": True,
        },
    )
    assert create_personal.status_code == 201
    personal_id = create_personal.json()["id"]
    assert create_personal.json()["scope"] == "personal"

    # VIEW cannot create shared view
    create_shared_view = client.post(
        "/api/v1/dashboard/views",
        headers=view_headers,
        json={
            "name": "Compartilhada indevida",
            "tab_key": "painel",
            "scope": "shared",
            "payload_json": {"filters": {}},
        },
    )
    assert create_shared_view.status_code == 403

    # ADMIN can create shared view
    create_shared_admin = client.post(
        "/api/v1/dashboard/views",
        headers=admin_headers,
        json={
            "name": "Visao compartilhada",
            "tab_key": "painel",
            "scope": "shared",
            "payload_json": {"filters": {"municipio": "Anapolis"}},
            "is_pinned": False,
        },
    )
    assert create_shared_admin.status_code == 201
    shared_id = create_shared_admin.json()["id"]
    assert create_shared_admin.json()["scope"] == "shared"

    # VIEW lists own + shared
    list_view = client.get("/api/v1/dashboard/views?tab_key=painel", headers=view_headers)
    assert list_view.status_code == 200
    list_payload = list_view.json()
    ids = {item["id"] for item in list_payload["items"]}
    assert personal_id in ids
    assert shared_id in ids

    # VIEW can update own personal
    patch_own = client.patch(
        f"/api/v1/dashboard/views/{personal_id}",
        headers=view_headers,
        json={"name": "Minha visao editada", "is_pinned": False},
    )
    assert patch_own.status_code == 200
    assert patch_own.json()["name"] == "Minha visao editada"

    # VIEW cannot update shared
    patch_shared_by_view = client.patch(
        f"/api/v1/dashboard/views/{shared_id}",
        headers=view_headers,
        json={"name": "Tentativa indevida"},
    )
    assert patch_shared_by_view.status_code == 403

    # VIEW cannot delete shared
    delete_shared_by_view = client.delete(
        f"/api/v1/dashboard/views/{shared_id}",
        headers=view_headers,
    )
    assert delete_shared_by_view.status_code == 403

    # ADMIN can update and delete shared
    patch_shared_by_admin = client.patch(
        f"/api/v1/dashboard/views/{shared_id}",
        headers=admin_headers,
        json={"name": "Compartilhada atualizada", "is_pinned": True},
    )
    assert patch_shared_by_admin.status_code == 200
    assert patch_shared_by_admin.json()["name"] == "Compartilhada atualizada"

    delete_shared_by_admin = client.delete(
        f"/api/v1/dashboard/views/{shared_id}",
        headers=admin_headers,
    )
    assert delete_shared_by_admin.status_code == 204


def test_dashboard_views_enforce_org_isolation(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    db = SessionLocal()
    try:
        other_org = Org(name="Other Org Dashboard", slug=f"other-dash-{uuid.uuid4().hex[:6]}")
        db.add(other_org)
        db.commit()
        db.refresh(other_org)
        foreign_view = DashboardSavedView(
            org_id=other_org.id,
            created_by_user_id=me["id"],
            name="Foreign",
            tab_key="painel",
            scope="shared",
            payload_json={},
            is_pinned=False,
        )
        db.add(foreign_view)
        db.commit()
        db.refresh(foreign_view)
        foreign_id = foreign_view.id
    finally:
        db.close()

    list_response = client.get("/api/v1/dashboard/views?tab_key=painel", headers=admin_headers)
    assert list_response.status_code == 200
    ids = {item["id"] for item in list_response.json()["items"]}
    assert foreign_id not in ids

    patch_response = client.patch(
        f"/api/v1/dashboard/views/{foreign_id}",
        headers=admin_headers,
        json={"name": "Nope"},
    )
    assert patch_response.status_code == 404
