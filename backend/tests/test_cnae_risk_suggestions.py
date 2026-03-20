from __future__ import annotations

from app.db.session import SessionLocal
from app.models.cnae_risk import CNAERisk
from app.models.cnae_risk_suggestion import CNAERiskSuggestion
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.org import Org


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _first_org(db) -> Org:
    org = db.query(Org).first()
    assert org is not None
    return org


def _ensure_cnae_risk(db, code: str, risk_tier: str = "LOW", base_weight: int = 10) -> None:
    item = db.query(CNAERisk).filter(CNAERisk.cnae_code == code).first()
    if item:
        item.risk_tier = risk_tier
        item.base_weight = base_weight
        item.sanitary_risk = "LOW"
        item.fire_risk = "LOW"
        item.environmental_risk = "LOW"
        item.is_active = True
        return
    db.add(
        CNAERisk(
            cnae_code=code,
            cnae_text="Atividade teste",
            risk_tier=risk_tier,
            base_weight=base_weight,
            sanitary_risk="LOW",
            fire_risk="LOW",
            environmental_risk="LOW",
            source="test",
            is_active=True,
        )
    )


def test_cnae_risk_suggestions_crud_and_reject(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/catalog/cnae-risk-suggestions",
        headers=headers,
        json={
            "cnae_code": "5611201",
            "suggested_risk_tier": "medium",
            "suggested_base_weight": 28,
            "suggested_sanitary_risk": "medium",
            "suggested_fire_risk": "low",
            "suggested_environmental_risk": "low",
            "source_name": "ANVISA",
            "source_reference": "RDC-XYZ",
            "evidence_excerpt": "trecho oficial",
        },
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["cnae_code"] == "56.11-2-01"
    assert payload["status"] == "PENDING"
    suggestion_id = payload["id"]

    listed = client.get("/api/v1/catalog/cnae-risk-suggestions", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == suggestion_id for item in listed.json())

    edited = client.patch(
        f"/api/v1/catalog/cnae-risk-suggestions/{suggestion_id}",
        headers=headers,
        json={"suggested_base_weight": 35},
    )
    assert edited.status_code == 200
    assert edited.json()["suggested_base_weight"] == 35

    rejected = client.post(
        f"/api/v1/catalog/cnae-risk-suggestions/{suggestion_id}/reject",
        headers=headers,
        json={"evidence_excerpt": "nao aderente ao critério"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert rejected.json()["reviewed_by"] is not None
    assert rejected.json()["reviewed_at"] is not None

    cannot_edit = client.patch(
        f"/api/v1/catalog/cnae-risk-suggestions/{suggestion_id}",
        headers=headers,
        json={"suggested_base_weight": 40},
    )
    assert cannot_edit.status_code == 409


def test_cnae_risk_suggestion_approve_applies_catalog_and_recalculates(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="LOW", base_weight=10)

        company = Company(org_id=org.id, cnpj="77777777000177", razao_social="Empresa CNAE Sugerido")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "5611201", "text": "Restaurantes e similares"}],
                raw={},
            )
        )
        db.commit()
    finally:
        db.close()

    created = client.post(
        "/api/v1/catalog/cnae-risk-suggestions",
        headers=headers,
        json={
            "cnae_code": "56.11-2-01",
            "suggested_risk_tier": "HIGH",
            "suggested_base_weight": 55,
            "suggested_sanitary_risk": "HIGH",
            "suggested_fire_risk": "MEDIUM",
            "suggested_environmental_risk": "LOW",
            "source_name": "Fonte Oficial",
            "source_reference": "IN 2026/10",
            "evidence_excerpt": "Classificação revisada por norma",
        },
    )
    assert created.status_code == 201
    suggestion_id = created.json()["id"]

    approved = client.post(
        f"/api/v1/catalog/cnae-risk-suggestions/{suggestion_id}/approve",
        headers=headers,
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["suggestion"]["status"] == "APPLIED"
    assert body["applied_to_catalog"] is True
    assert body["affected_companies"] >= 1
    assert body["recalculated_companies"] >= 1

    db = SessionLocal()
    try:
        risk = db.query(CNAERisk).filter(CNAERisk.cnae_code == "56.11-2-01").first()
        assert risk is not None
        assert risk.risk_tier == "HIGH"
        assert risk.base_weight == 55
        assert risk.sanitary_risk == "HIGH"
        assert risk.fire_risk == "MEDIUM"
        assert risk.environmental_risk == "LOW"
        assert risk.source == "Fonte Oficial"

        profile = db.query(CompanyProfile).filter(CompanyProfile.cnaes_principal.is_not(None)).first()
        assert profile is not None
        assert profile.risco_consolidado == "HIGH"
        assert profile.score_urgencia == 55
        assert profile.score_status == "NO_LICENCE"
        assert profile.score_updated_at is not None
    finally:
        db.close()


def test_cnae_risk_suggestion_approve_requires_pending(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        suggestion = CNAERiskSuggestion(
            org_id=None,
            cnae_code="62.01-5-01",
            suggested_risk_tier="LOW",
            suggested_base_weight=15,
            source_name="Seed",
            source_reference="bootstrap",
            status="REJECTED",
        )
        db.add(suggestion)
        db.commit()
        suggestion_id = suggestion.id
    finally:
        db.close()

    response = client.post(
        f"/api/v1/catalog/cnae-risk-suggestions/{suggestion_id}/approve",
        headers=headers,
    )
    assert response.status_code == 409
