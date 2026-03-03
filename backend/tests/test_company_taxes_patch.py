from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_tax import CompanyTax


def _login(client: TestClient) -> tuple[dict, str]:
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    return headers, me.json()["org_id"]


def test_patch_tax_data_envio_accepts_date_with_methods(client: TestClient):
    headers, org_id = _login(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="99999999000199", razao_social="Taxas SA")
        db.add(company)
        db.flush()
        tax = CompanyTax(org_id=org_id, company_id=company.id, data_envio=None)
        db.add(tax)
        db.commit()
        db.refresh(tax)
    finally:
        db.close()

    response = client.patch(
        f"/api/v1/taxas/{tax.id}",
        headers=headers,
        json={"data_envio": "2026-02-05 - Nº Escritório; E-mail"},
    )
    assert response.status_code == 200
    assert response.json()["data_envio"] == "05/02/2026 - Nº Escritório; E-mail"


def test_patch_tax_data_envio_empty_string_turns_null(client: TestClient):
    headers, org_id = _login(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="88888888000199", razao_social="Taxas Null SA")
        db.add(company)
        db.flush()
        tax = CompanyTax(org_id=org_id, company_id=company.id, data_envio="05/02/2026 - E-mail")
        db.add(tax)
        db.commit()
        db.refresh(tax)
    finally:
        db.close()

    response = client.patch(
        f"/api/v1/taxas/{tax.id}",
        headers=headers,
        json={"data_envio": ""},
    )
    assert response.status_code == 200
    assert response.json()["data_envio"] is None


def test_patch_tax_recalculates_status_taxas(client: TestClient):
    headers, org_id = _login(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="77777777000199", razao_social="Taxas Calc SA")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_funcionamento="isento",
            taxa_publicidade="isento",
            taxa_vig_sanitaria="isento",
            taxa_localiz_instalacao="isento",
            taxa_ocup_area_publica="isento",
            taxa_bombeiros="isento",
            tpi="isento",
            status_taxas="irregular",
        )
        db.add(tax)
        db.commit()
        db.refresh(tax)
    finally:
        db.close()

    response_regular = client.patch(
        f"/api/v1/taxas/{tax.id}",
        headers=headers,
        json={"taxa_funcionamento": "isento"},
    )
    assert response_regular.status_code == 200
    assert response_regular.json()["status_taxas"] == "regular"

    response_irregular = client.patch(
        f"/api/v1/taxas/{tax.id}",
        headers=headers,
        json={"taxa_publicidade": "em_aberto"},
    )
    assert response_irregular.status_code == 200
    assert response_irregular.json()["status_taxas"] == "irregular"
    assert response_irregular.json()["envio_pendente"] is True
    assert response_irregular.json()["motivo_envio_pendente"]

    response_envio = client.patch(
        f"/api/v1/taxas/{tax.id}",
        headers=headers,
        json={"data_envio": "05/03/2026 - E-mail"},
    )
    assert response_envio.status_code == 200
    assert response_envio.json()["envio_pendente"] is False
    assert response_envio.json()["motivo_envio_pendente"] is None
