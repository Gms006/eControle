from fastapi.testclient import TestClient
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.db.session import SessionLocal


def test_profile_and_aux_endpoints(client: TestClient):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    org_id = me.json()["org_id"]

    # create an org and a company via direct DB manipulation since no CREATE endpoint for profile
    db = SessionLocal()
    # create a company and profile
    company = Company(org_id=org_id, cnpj="123", razao_social="X Corp")
    db.add(company)
    db.flush()
    profile = CompanyProfile(
        org_id=company.org_id,
        company_id=company.id,
        telefone="555",
        inscricao_municipal="IM123",
    )
    db.add(profile)
    db.commit()
    db.refresh(company)

    # list companies should include profile fields
    res = client.get("/api/v1/companies", headers=headers)
    assert res.status_code == 200
    body = res.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert isinstance(items, list)
    assert any(item.get("telefone") == "555" for item in items)
    assert any(
        item.get("inscricao_municipal") == "IM123" or item.get("inscricaoMunicipal") == "IM123"
        for item in items
    )

    # endpoints for licencas/taxas/processos currently empty; should respond 200 with list
    for path in ["licencas", "taxas", "processos", "profiles"]:
        r = client.get(f"/api/v1/{path}", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list) or isinstance(body, dict)
