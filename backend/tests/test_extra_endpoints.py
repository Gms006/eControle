from fastapi.testclient import TestClient
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.db.session import SessionLocal


def test_profile_and_aux_endpoints(client: TestClient):
    # create an org and a company via direct DB manipulation since no CREATE endpoint for profile
    db = SessionLocal()
    # create a company and profile
    company = Company(org_id="org1", cnpj="123", razao_social="X Corp")
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
    res = client.get("/api/v1/companies")
    assert res.status_code == 200
    items = res.json().get("items") or res.json()
    assert isinstance(items, list)
    assert any(item.get("telefone") == "555" for item in items)
    assert any(item.get("inscricaoMunicipal") == "IM123" for item in items)

    # endpoints for licencas/taxas/processos currently empty; should respond 200 with list
    for path in ["licencas", "taxas", "processos", "profiles"]:
        r = client.get(f"/api/v1/{path}")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list) or isinstance(body, dict)
