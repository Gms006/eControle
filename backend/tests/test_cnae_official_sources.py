from __future__ import annotations

from app.db.session import SessionLocal
from app.models.cnae_risk import CNAERisk
from app.models.cnae_risk_suggestion import CNAERiskSuggestion
from app.services.official_sources.cbmgo import lookup_cnae as lookup_cbmgo


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_lookup_single_creates_pending_suggestions_without_catalog_apply(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup",
        headers=headers,
        json={"cnae_code": "56.11-2-01"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["findings"], list)
    assert len(body["findings"]) >= 1
    assert isinstance(body["suggestions_created"], list)
    assert len(body["suggestions_created"]) >= 1
    assert all(item["status"] == "PENDING" for item in body["suggestions_created"])

    db = SessionLocal()
    try:
        catalog_rows = db.query(CNAERisk).all()
        assert len(catalog_rows) == 0
    finally:
        db.close()


def test_lookup_avoids_duplicate_pending_suggestions(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"cnae_code": "56.11-2-01", "sources": ["ANVISA"]}

    first = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup",
        headers=headers,
        json=payload,
    )
    assert first.status_code == 200
    assert len(first.json()["suggestions_created"]) == 1

    second = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup",
        headers=headers,
        json=payload,
    )
    assert second.status_code == 200
    assert len(second.json()["suggestions_created"]) == 0
    assert second.json()["skipped_duplicates"] >= 1

    db = SessionLocal()
    try:
        count = (
            db.query(CNAERiskSuggestion)
            .filter(
                CNAERiskSuggestion.cnae_code == "56.11-2-01",
                CNAERiskSuggestion.source_name == "ANVISA",
                CNAERiskSuggestion.status == "PENDING",
            )
            .count()
        )
        assert count == 1
    finally:
        db.close()


def test_cbmgo_always_flags_requires_questionnaire():
    findings = lookup_cbmgo("56.11-2-01")
    assert len(findings) == 1
    finding = findings[0]
    assert finding.source_name == "CBMGO"
    assert finding.domain == "fire"
    assert finding.requires_questionnaire is True
    assert finding.suggested_risk_tier is None
    assert finding.suggested_base_weight is None


def test_lookup_batch_returns_source_errors_without_breaking(client, monkeypatch):
    from app.services import cnae_official_suggestions as orchestrator

    def _boom(_cnae_code: str):
        raise RuntimeError("temporary source outage")

    monkeypatch.setitem(orchestrator.OFFICIAL_SOURCE_ADAPTERS, "ANVISA", _boom)

    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup-batch",
        headers=headers,
        json={"cnae_codes": ["56.11-2-01", "62.01-5-01"], "sources": ["ANVISA", "CBMGO"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["source_errors"], list)
    assert any(error["source_name"] == "ANVISA" for error in body["source_errors"])
    assert isinstance(body["findings"], list)
