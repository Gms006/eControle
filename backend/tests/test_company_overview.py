from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.certificate_mirror import CertificateMirror
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.models.org import Org


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _default_org_id() -> str:
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        return org.id
    finally:
        db.close()


def _create_company_full(org_id: str) -> str:
    db = SessionLocal()
    try:
        company = Company(
            org_id=org_id,
            cnpj="12345678000199",
            razao_social="Empresa Overview Ltda",
            nome_fantasia="Overview",
            municipio="Anápolis",
            uf="GO",
        )
        db.add(company)
        db.flush()

        db.add(
            CompanyProfile(
                org_id=org_id,
                company_id=company.id,
                status_empresa="ativa",
                risco_consolidado="HIGH",
                score_urgencia=88,
                score_status="OK",
                telefone="62999999999",
                email="contato@overview.test",
            )
        )
        db.add(
            CompanyTax(
                org_id=org_id,
                company_id=company.id,
                taxa_funcionamento="em_aberto",
                taxa_publicidade="regular",
                tpi="pendente",
                vencimento_tpi=(date.today() + timedelta(days=5)).isoformat(),
                raw={
                    "vencimento_taxa_funcionamento": (date.today() - timedelta(days=2)).isoformat(),
                    "valor_taxa_funcionamento": "500,00",
                    "competencia_taxa_funcionamento": "2026-03",
                },
            )
        )
        db.add(
            CompanyLicence(
                org_id=org_id,
                company_id=company.id,
                alvara_vig_sanitaria="vencido",
                alvara_vig_sanitaria_valid_until=date.today() - timedelta(days=1),
                cercon="possui",
                cercon_valid_until=date.today() + timedelta(days=25),
                raw={"source_kind_alvara_vig_sanitaria": "dated"},
            )
        )
        db.add(
            CompanyProcess(
                org_id=org_id,
                company_id=company.id,
                process_type="DIVERSOS",
                protocolo="PROC-001",
                operacao="Renovação",
                situacao="pendente",
            )
        )
        db.add(
            CertificateMirror(
                org_id=org_id,
                company_id=company.id,
                cert_id="cert-1",
                sha1_fingerprint="AA:BB:CC",
                not_after=datetime.now(timezone.utc) + timedelta(days=15),
            )
        )
        db.commit()
        return company.id
    finally:
        db.close()


def _create_company_partial(org_id: str) -> str:
    db = SessionLocal()
    try:
        company = Company(
            org_id=org_id,
            cnpj="22345678000199",
            razao_social="Empresa Parcial",
            municipio="Anápolis",
            uf="GO",
        )
        db.add(company)
        db.flush()
        db.add(CompanyProfile(org_id=org_id, company_id=company.id))
        db.commit()
        return company.id
    finally:
        db.close()


def _create_other_org_company() -> str:
    db = SessionLocal()
    try:
        org = Org(name="Overview Other Org", slug="overview-other-org")
        db.add(org)
        db.flush()
        company = Company(org_id=org.id, cnpj="99345678000199", razao_social="Outra Org")
        db.add(company)
        db.commit()
        return company.id
    finally:
        db.close()


def test_company_overview_returns_200_same_org(client):
    token = _login(client)
    org_id = _default_org_id()
    company_id = _create_company_full(org_id)

    response = client.get(
        f"/api/v1/companies/{company_id}/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["company"]["id"] == company_id
    assert payload["summary"]["pending_taxes_count"] >= 1
    assert payload["summary"]["critical_licences_count"] >= 1
    assert payload["summary"]["open_processes_count"] >= 1
    assert payload["certificate"]["exists"] is True
    assert payload["summary"]["risk_tier"] == "HIGH"


def test_company_overview_returns_404_not_found(client):
    token = _login(client)
    response = client.get(
        "/api/v1/companies/00000000-0000-0000-0000-000000000000/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_company_overview_blocks_cross_org(client):
    token = _login(client)
    other_company_id = _create_other_org_company()
    response = client.get(
        f"/api/v1/companies/{other_company_id}/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_company_overview_handles_partial_data(client):
    token = _login(client)
    org_id = _default_org_id()
    company_id = _create_company_partial(org_id)
    response = client.get(
        f"/api/v1/companies/{company_id}/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["company"]["id"] == company_id
    assert payload["certificate"]["exists"] is False
    assert payload["taxes"] == []
    assert payload["licences"] == []
    assert payload["processes"] == []
    assert payload["summary"]["pending_taxes_count"] == 0
    assert payload["summary"]["critical_licences_count"] == 0
    assert payload["summary"]["open_processes_count"] == 0


def test_company_overview_optional_fields_keep_nulls(client):
    token = _login(client)
    org_id = _default_org_id()
    company_id = _create_company_partial(org_id)
    response = client.get(
        f"/api/v1/companies/{company_id}/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["score"]["risk_tier"] is None
    assert payload["score"]["score_urgencia"] is None
    assert payload["score"]["score_status"] is None
    assert payload["certificate"]["validade"] is None
