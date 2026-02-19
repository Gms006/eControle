from uuid import uuid4

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _ensure_view_user(org_id: str) -> None:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        if not role:
            role = Role(name="VIEW")
            db.add(role)
            db.commit()
            db.refresh(role)

        user = db.query(User).filter(User.email == "view@example.com").first()
        if not user:
            user = User(
                email="view@example.com",
                hashed_password=hash_password("view123"),
                org_id=org_id,
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


def _create_company_in_other_org() -> Company:
    db = SessionLocal()
    try:
        org = db.query(Org).filter(Org.name == "Other Org").first()
        if not org:
            org = Org(name="Other Org", slug="other-org")
            db.add(org)
            db.commit()
            db.refresh(org)
        cnpj = uuid4().hex[:14]
        company = Company(
            org_id=org.id,
            cnpj=cnpj,
            razao_social="Outra Empresa",
            nome_fantasia="Outra",
            municipio="Other City",
            uf="SP",
            is_active=True,
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        return company
    finally:
        db.close()


def test_companies_require_auth(client):
    response = client.get("/api/v1/companies")
    assert response.status_code == 401

    response = client.post(
        "/api/v1/companies",
        json={"cnpj": "12345678000199", "razao_social": "Empresa Teste"},
    )
    assert response.status_code == 401


def test_view_permissions_for_companies(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    _ensure_view_user(me["org_id"])
    view_token = _login(client, "view@example.com", "view123")

    create_response = client.post(
        "/api/v1/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "cnpj": "12.345.678/0001-99",
            "razao_social": "Empresa Admin",
            "nome_fantasia": "Admin Co",
            "municipio": "Campinas",
            "uf": "SP",
        },
    )
    assert create_response.status_code == 200
    company_id = create_response.json()["id"]

    list_response = client.get(
        "/api/v1/companies",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert list_response.status_code == 200
    assert any(item["id"] == company_id for item in list_response.json())

    detail_response = client.get(
        f"/api/v1/companies/{company_id}",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert detail_response.status_code == 200

    view_create = client.post(
        "/api/v1/companies",
        headers={"Authorization": f"Bearer {view_token}"},
        json={"cnpj": "11222333000100", "razao_social": "Sem Permissao"},
    )
    assert view_create.status_code == 403

    view_patch = client.patch(
        f"/api/v1/companies/{company_id}",
        headers={"Authorization": f"Bearer {view_token}"},
        json={"razao_social": "Nao Pode"},
    )
    assert view_patch.status_code == 403


def test_admin_can_create_and_update_company(client):
    admin_token = _login(client, "admin@example.com", "admin123")

    create_response = client.post(
        "/api/v1/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "cnpj": "12.345.678/0001-90",
            "razao_social": "Empresa Alpha",
            "municipio": "Sao Paulo",
            "uf": "SP",
        },
    )
    assert create_response.status_code == 200
    company = create_response.json()
    assert company["cnpj"] == "12345678000190"

    update_response = client.patch(
        f"/api/v1/companies/{company['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"razao_social": "Empresa Alpha Atualizada", "is_active": False},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["razao_social"] == "Empresa Alpha Atualizada"
    assert updated["is_active"] is False


def test_company_isolation_between_orgs(client):
    _create_company_in_other_org()
    admin_token = _login(client, "admin@example.com", "admin123")

    list_response = client.get(
        "/api/v1/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_response.status_code == 200
    assert list_response.json() == []

    other_company = _create_company_in_other_org()
    detail_response = client.get(
        f"/api/v1/companies/{other_company.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert detail_response.status_code == 404
