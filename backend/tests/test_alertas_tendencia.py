from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence


def test_alertas_tendencia_returns_monthly_series(client: TestClient):
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

    db = SessionLocal()
    company = Company(org_id=org_id, cnpj="99999999000100", razao_social="Trend Test LTDA")
    db.add(company)
    db.flush()

    today = date.today()
    last_month = (today.replace(day=1) - timedelta(days=3)).replace(day=10)
    this_month = today.replace(day=min(20, today.day))

    licence = CompanyLicence(
        org_id=org_id,
        company_id=company.id,
        municipio="Goiania",
        alvara_vig_sanitaria="possui",
        cercon="vencido",
        raw={
            "validade_alvara_vig_sanitaria": this_month.isoformat(),
            "validade_cercon": last_month.isoformat(),
        },
    )
    db.add(licence)
    db.commit()

    response = client.get("/api/v1/alertas/tendencia", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
    assert isinstance(body.get("items"), list)
    assert len(body["items"]) >= 6
    assert any((item.get("alertas_vencendo") or 0) > 0 for item in body["items"])
