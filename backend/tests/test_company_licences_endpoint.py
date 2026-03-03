from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _org_id(client, headers: dict[str, str]) -> str:
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()["org_id"]


def test_licencas_list_enriches_company_fields(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(org_id=org_id, cnpj="12345678000110", razao_social="Empresa Licenca")
    db.add(company)
    db.flush()
    licence = CompanyLicence(
        org_id=org_id,
        company_id=company.id,
        alvara_vig_sanitaria="sujeito",
    )
    db.add(licence)
    db.commit()

    response = client.get("/api/v1/licencas", headers=headers)
    assert response.status_code == 200
    data = response.json()
    row = next(item for item in data if item["id"] == licence.id)
    assert row["company_name"] == "Empresa Licenca"
    assert row["company_cnpj"] == "12345678000110"
    assert row["sem_vinculo"] is False


def test_licencas_list_fallback_when_company_is_missing(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    orphan = CompanyLicence(
        org_id=org_id,
        company_id="00000000-0000-0000-0000-000000000999",
        alvara_vig_sanitaria="nao_possui",
    )
    db.add(orphan)
    db.commit()

    response = client.get("/api/v1/licencas", headers=headers)
    assert response.status_code == 200
    data = response.json()
    row = next(item for item in data if item["id"] == orphan.id)
    assert row["sem_vinculo"] is True
    assert "Empresa não vinculada" in row["company_name"]


def test_patch_licenca_item_requires_reason_when_nao_exigido(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(org_id=org_id, cnpj="22345678000110", razao_social="Empresa Patch")
    db.add(company)
    db.flush()
    licence = CompanyLicence(
        org_id=org_id,
        company_id=company.id,
        alvara_vig_sanitaria="sujeito",
    )
    db.add(licence)
    db.commit()

    bad_response = client.patch(
        f"/api/v1/licencas/{licence.id}/item",
        headers=headers,
        json={"field": "alvara_vig_sanitaria", "status": "nao_exigido"},
    )
    assert bad_response.status_code == 422

    ok_response = client.patch(
        f"/api/v1/licencas/{licence.id}/item",
        headers=headers,
        json={
            "field": "alvara_vig_sanitaria",
            "status": "nao_exigido",
            "motivo_nao_exigido": "zoneamento_nao_aplica",
            "justificativa_nao_exigido": "Atividade sem exigencia sanitária municipal.",
            "validade": "2026-12-31",
        },
    )
    assert ok_response.status_code == 200
    row = ok_response.json()
    assert row["alvara_vig_sanitaria"] == "nao_exigido"
    assert row["motivo_nao_exigido"] == "zoneamento_nao_aplica"
    assert row["justificativa_nao_exigido"] == "Atividade sem exigencia sanitária municipal."
