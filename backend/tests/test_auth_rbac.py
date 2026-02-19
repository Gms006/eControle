from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.role import Role
from app.models.org import Org
from app.models.user import User


def _create_view_user():
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        if not role:
            role = Role(name="VIEW")
            db.add(role)
            db.commit()
            db.refresh(role)
        org = db.query(Org).first()
        if not org:
            org = Org(name="Test Org", slug="test-org")
            db.add(org)
            db.commit()
            db.refresh(org)
        elif not org.slug:
            org.slug = "test-org"
            db.commit()
        user = User(
            email="view@example.com",
            hashed_password=hash_password("view123"),
            org_id=org.id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
    finally:
        db.close()


def test_rbac_admin_ping(client):
    _create_view_user()

    view_login = client.post(
        "/api/v1/auth/login",
        json={"email": "view@example.com", "password": "view123"},
    )
    assert view_login.status_code == 200
    view_token = view_login.json()["access_token"]
    view_ping = client.get(
        "/api/v1/auth/admin/ping",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert view_ping.status_code == 403

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_ping = client.get(
        "/api/v1/auth/admin/ping",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_ping.status_code == 200
