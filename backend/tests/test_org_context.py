from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def _ensure_view_user() -> None:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        if not role:
            role = Role(name="VIEW")
            db.add(role)
            db.commit()
            db.refresh(role)

        org = db.query(Org).filter(Org.name == "View Org").first()
        if not org:
            org = Org(name="View Org", slug="view-org")
            db.add(org)
            db.commit()
            db.refresh(org)

        user = db.query(User).filter(User.email == "view@example.com").first()
        if not user:
            user = User(
                email="view@example.com",
                hashed_password=hash_password("view123"),
                org_id=org.id,
                is_active=True,
            )
            user.roles.append(role)
            db.add(user)
            db.commit()
        elif role not in user.roles:
            user.roles.append(role)
            db.commit()
    finally:
        db.close()


def _create_other_org() -> Org:
    db = SessionLocal()
    try:
        org = db.query(Org).filter(Org.name == "Other Org").first()
        if not org:
            org = Org(name="Other Org", slug="other-org")
            db.add(org)
            db.commit()
            db.refresh(org)
        return org
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_org_current_requires_auth(client):
    response = client.get("/api/v1/orgs/current")
    assert response.status_code == 401


def test_org_current_returns_user_org(client):
    token = _login(client, "admin@example.com", "admin123")
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    me = me_response.json()

    org_response = client.get(
        "/api/v1/orgs/current",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert org_response.status_code == 200
    org = org_response.json()
    assert org["id"] == me["org_id"]


def test_org_header_mismatch_forbidden(client):
    token = _login(client, "admin@example.com", "admin123")
    other_org = _create_other_org()

    org_response = client.get(
        "/api/v1/orgs/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Org-Id": other_org.id,
        },
    )
    assert org_response.status_code == 403


def test_org_slug_header_mismatch_forbidden(client):
    token = _login(client, "admin@example.com", "admin123")
    org_response = client.get(
        "/api/v1/orgs/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Org-Slug": "slug-que-nao-existe",
        },
    )
    assert org_response.status_code == 403


def test_org_list_requires_admin(client):
    _ensure_view_user()
    view_token = _login(client, "view@example.com", "view123")
    view_response = client.get(
        "/api/v1/orgs/list",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert view_response.status_code == 403

    admin_token = _login(client, "admin@example.com", "admin123")
    admin_response = client.get(
        "/api/v1/orgs/list",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_response.status_code == 200
