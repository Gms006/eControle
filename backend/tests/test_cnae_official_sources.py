from __future__ import annotations

import httpx

from app.db.session import SessionLocal
from app.models.cnae_risk import CNAERisk
from app.models.cnae_risk_suggestion import CNAERiskSuggestion
from app.schemas.official_sources import OfficialSourceFinding
from app.services import cnae_official_suggestions as orchestrator
from app.services.official_sources import anapolis, anvisa, cbmgo, cgsim


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_lookup_anapolis_with_mocked_online_parser():
    def _fake_fetch(_url: str) -> str:
        return "Anexo Unico LC 377/2018 CNAE 56.11-2-01 Complexidade III."

    original_fetch = anapolis._fetch_source_text
    anapolis._fetch_source_text = _fake_fetch
    try:
        findings = anapolis.lookup_cnae("56.11-2-01")
    finally:
        anapolis._fetch_source_text = original_fetch

    assert len(findings) >= 1
    assert all(item.source_name == "ANAPOLIS" for item in findings)
    assert any(item.source_reference for item in findings)


def test_lookup_anvisa_with_mocked_online_parser():
    def _fake_fetch(_url: str) -> str:
        return "IN 66/2020 lista CNAE 56.11-2-01 como atividade de alto risco sanitario."

    original_fetch = anvisa._fetch_source_text
    anvisa._fetch_source_text = _fake_fetch
    try:
        findings = anvisa.lookup_cnae("56.11-2-01")
    finally:
        anvisa._fetch_source_text = original_fetch

    assert len(findings) == 1
    assert findings[0].source_name == "ANVISA"
    assert findings[0].domain == "sanitary"
    assert findings[0].suggested_risk_tier == "HIGH"


def test_cgsim_fallback_when_direct_url_returns_403(monkeypatch):
    class _FakeResponse:
        def __init__(self, url: str, status_code: int, text: str):
            self.url = url
            self.status_code = status_code
            self.content = text.encode("utf-8")
            self.request = httpx.Request("GET", url)

        def raise_for_status(self) -> None:
            if self.status_code >= 400:
                raise httpx.HTTPStatusError("status error", request=self.request, response=self)

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url: str):
            if url == cgsim._PRIMARY_DOC_URL:
                return _FakeResponse(url, 403, "forbidden")
            if url == cgsim._VIEW_DOC_URL:
                return _FakeResponse(url, 200, "Resolucao CGSIM com CNAE 62.01-5-01 de baixo risco.")
            if url == cgsim._INDEX_URL:
                return _FakeResponse(url, 200, "indice oficial")
            return _FakeResponse(url, 404, "not found")

    monkeypatch.setattr(cgsim.httpx, "Client", _FakeClient)
    findings = cgsim.lookup_cnae("62.01-5-01")
    assert len(findings) == 1
    finding = findings[0]
    assert finding.source_name == "CGSIM"
    assert finding.source_reference == cgsim._VIEW_DOC_URL
    assert finding.requires_questionnaire is False


def test_lookup_single_creates_pending_suggestions_without_catalog_apply(client, monkeypatch):
    monkeypatch.setitem(
        orchestrator.OFFICIAL_SOURCE_ADAPTERS,
        "ANAPOLIS",
        lambda code: [
            OfficialSourceFinding(
                cnae_code=code,
                domain="municipal",
                official_result="Regra municipal objetiva.",
                suggested_risk_tier="LOW",
                suggested_base_weight=10,
                source_name="ANAPOLIS",
                source_reference="https://anapolis.example/oficial",
                evidence_excerpt="CNAE listado objetivamente.",
                confidence=0.9,
                requires_questionnaire=False,
            )
        ],
    )

    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup",
        headers=headers,
        json={"cnae_code": "56.11-2-01", "sources": ["ANAPOLIS"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["suggestions_created"]) == 1
    assert body["suggestions_created"][0]["status"] == "PENDING"

    db = SessionLocal()
    try:
        assert db.query(CNAERisk).count() == 0
    finally:
        db.close()


def test_lookup_avoids_duplicate_pending_suggestions(client, monkeypatch):
    monkeypatch.setitem(
        orchestrator.OFFICIAL_SOURCE_ADAPTERS,
        "ANVISA",
        lambda code: [
            OfficialSourceFinding(
                cnae_code=code,
                domain="sanitary",
                official_result="Regra sanitaria objetiva",
                suggested_risk_tier="HIGH",
                suggested_base_weight=None,
                source_name="ANVISA",
                source_reference="https://anvisa.example/in66",
                evidence_excerpt="IN 66/2020 CNAE 56.11-2-01",
                confidence=0.9,
                requires_questionnaire=False,
            )
        ],
    )
    monkeypatch.setitem(orchestrator.OFFICIAL_SOURCE_ADAPTERS, "ANAPOLIS", lambda _code: [])

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
    findings = cbmgo.lookup_cnae("56.11-2-01")
    assert len(findings) == 1
    finding = findings[0]
    assert finding.source_name == "CBMGO"
    assert finding.domain == "fire"
    assert finding.requires_questionnaire is True
    assert finding.suggested_risk_tier is None
    assert finding.suggested_base_weight is None


def test_lookup_batch_returns_source_errors_without_breaking(client, monkeypatch):
    def _boom(_cnae_code: str):
        raise RuntimeError("temporary source outage")

    monkeypatch.setitem(orchestrator.OFFICIAL_SOURCE_ADAPTERS, "ANVISA", _boom)
    monkeypatch.setitem(
        orchestrator.OFFICIAL_SOURCE_ADAPTERS,
        "CBMGO",
        lambda code: cbmgo.lookup_cnae(code),
    )

    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/catalog/cnae-risk-suggestions/official/lookup-batch",
        headers=headers,
        json={"cnae_codes": ["56.11-2-01", "62.01-5-01"], "sources": ["ANVISA", "CBMGO"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert any(error["source_name"] == "ANVISA" for error in body["source_errors"])
    assert isinstance(body["findings"], list)


def test_source_resolution_injects_anapolis_when_no_municipal_provided():
    names = orchestrator._resolve_source_names(["ANVISA", "CGSIM"])
    assert "ANAPOLIS" in names
    assert "GOIANIA" not in names


def test_goiania_kept_only_when_explicitly_requested():
    names_default = orchestrator._resolve_source_names(None)
    assert "GOIANIA" not in names_default

    names_explicit = orchestrator._resolve_source_names(["GOIANIA"])
    assert names_explicit == ["GOIANIA"]
