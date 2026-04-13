from __future__ import annotations

import io
import uuid

import pytest

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.company_profile import CompanyProfile
from app.models.company_tax import CompanyTax
from app.models.org import Org
from app.models.role import Role
from app.models.user import User
from app.services.copilot_provider import CopilotProviderError, ProviderCallMetadata


@pytest.fixture(autouse=True)
def _copilot_provider_defaults(monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_PROVIDER", "disabled")
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_MODEL", "gemini-2.5-flash")
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_ENABLE_WEB_SEARCH", False)
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_PROVIDER", "")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_BASE_URL", "")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")


def _login(client, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _get_me(client, token: str) -> dict:
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.json()


def _create_company_bundle(org_id: str) -> str:
    db = SessionLocal()
    try:
        company = Company(
            org_id=org_id,
            cnpj="12345678000199",
            razao_social="Empresa Copilot Teste",
            municipio="Anápolis",
            is_active=True,
        )
        db.add(company)
        db.flush()

        profile = CompanyProfile(
            org_id=org_id,
            company_id=company.id,
            cnaes_principal=[{"codigo": "56.11-2-01"}],
            risco_consolidado="HIGH",
            score_urgencia=70,
            score_status="OK",
        )
        db.add(profile)
        db.add(
            CompanyLicence(
                org_id=org_id,
                company_id=company.id,
                cercon="Vencido",
            )
        )
        db.add(
            CompanyTax(
                org_id=org_id,
                company_id=company.id,
                taxa_funcionamento="Em aberto",
                status_taxas="Irregular",
            )
        )
        db.add(
            CompanyProcess(
                org_id=org_id,
                company_id=company.id,
                process_type="ALVARA_SANITARIO",
                protocolo=f"PROC-{uuid.uuid4().hex[:8]}",
                situacao="Em andamento",
                operacao="Atualização Alvará",
            )
        )
        db.commit()
        return company.id
    finally:
        db.close()


def _create_view_user(org_id: str) -> tuple[str, str]:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        assert role is not None
        suffix = uuid.uuid4().hex[:8]
        email = f"view-copilot-{suffix}@example.com"
        password = "view123"
        user = User(
            email=email,
            hashed_password=hash_password(password),
            org_id=org_id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
        return email, password
    finally:
        db.close()


def test_copilot_rejects_invalid_category(client):
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/copilot/respond",
        headers=headers,
        data={"category": "INVALID", "company_id": "x", "message": "teste"},
    )
    assert response.status_code == 422


def test_copilot_company_not_found_or_outside_org(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    org_id = me["org_id"]
    _create_company_bundle(org_id)

    db = SessionLocal()
    other_org = Org(name="Other Org Copilot", slug=f"other-org-copilot-{uuid.uuid4().hex[:6]}")
    db.add(other_org)
    db.commit()
    db.refresh(other_org)
    db.close()
    foreign_company_id = _create_company_bundle(other_org.id)

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/v1/copilot/respond",
        headers=headers,
        data={"category": "COMPANY_SUMMARY", "company_id": foreign_company_id, "message": "resuma"},
    )
    assert response.status_code == 404


def test_copilot_duvidas_diversas_general_question_without_company(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DUVIDAS_DIVERSAS", "message": "O que influencia o score de urgência?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "DUVIDAS_DIVERSAS"
    assert payload["requires_company"] is False
    assert payload["company_context"]["company_id"] is None


def test_copilot_duvidas_diversas_requires_company_when_needed(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DUVIDAS_DIVERSAS", "message": "Essa empresa paga TPI?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["requires_company"] is True


def test_copilot_company_summary_returns_structured_payload(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "COMPANY_SUMMARY", "company_id": company_id, "message": "Resuma a situação desta empresa"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "COMPANY_SUMMARY"
    assert payload["company_context"]["company_id"] == company_id
    assert isinstance(payload["sections"], list) and len(payload["sections"]) >= 3
    assert isinstance(payload["suggested_actions"], list) and len(payload["suggested_actions"]) >= 3


def test_copilot_risk_simulation_does_not_persist_changes(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])

    db = SessionLocal()
    before = (
        db.query(CompanyProfile)
        .filter(CompanyProfile.org_id == me["org_id"], CompanyProfile.company_id == company_id)
        .first()
    )
    before_score = before.score_urgencia if before else None
    db.close()

    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={
            "category": "RISK_SIMULATION",
            "company_id": company_id,
            "message": "Se eu renovar o alvará bombeiros, o que muda?",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["simulation_result"] is not None

    db = SessionLocal()
    after = (
        db.query(CompanyProfile)
        .filter(CompanyProfile.org_id == me["org_id"], CompanyProfile.company_id == company_id)
        .first()
    )
    assert (after.score_urgencia if after else None) == before_score
    db.close()


def test_copilot_document_analysis_does_not_classify_from_filename_only(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DOCUMENT_ANALYSIS", "company_id": company_id, "message": "Analise o documento"},
        files={"document": ("CND - JB Comercial.pdf", io.BytesIO(b"conteudo sem marcadores"), "application/pdf")},
    )
    assert response.status_code == 200
    payload = response.json()
    tipo = None
    for section in payload["sections"]:
        if section["id"] == "tipo-provavel":
            for item in section["items"]:
                if str(item).startswith("Tipo:"):
                    tipo = str(item).split(":", 1)[1].strip()
    assert tipo in {"NAO_CONCLUSIVO", "OUTRO"}
    assert "compliance normativo" not in str(payload).lower()


def test_copilot_document_analysis_cnd_municipal_case_no_absurd_expansion(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    content = (
        b"Certidao Negativa de Debitos Municipais\n"
        b"Prefeitura Municipal de Anapolis\n"
        b"Razao Social: JB Comercial LTDA\n"
        b"Validade: 10/10/2027\n"
    )
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DOCUMENT_ANALYSIS", "company_id": company_id, "message": "Analise o documento"},
        files={"document": ("CND - JB Comercial.pdf", io.BytesIO(content), "application/pdf")},
    )
    assert response.status_code == 200
    payload = response.json()
    serialized = str(payload).lower()
    assert "compliance normativo" not in serialized
    assert "nao_conclusivo" in serialized or "cnd_municipal" in serialized


def test_copilot_document_analysis_allowed_types_only(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DOCUMENT_ANALYSIS", "company_id": company_id, "message": "Analise o documento"},
        files={"document": ("doc.png", io.BytesIO(b"Sem texto util"), "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    allowed = {
        "CND_MUNICIPAL",
        "CND_ESTADUAL",
        "CND_FEDERAL",
        "ALVARA_FUNCIONAMENTO",
        "ALVARA_SANITARIO",
        "LICENCA_AMBIENTAL",
        "CERTIFICADO_BOMBEIROS",
        "USO_DO_SOLO",
        "OUTRO",
        "NAO_CONCLUSIVO",
    }
    detected = None
    for section in payload["sections"]:
        if section["id"] == "tipo-provavel":
            for item in section["items"]:
                if str(item).startswith("Tipo:"):
                    detected = str(item).split(":", 1)[1].strip()
    assert detected in allowed


def test_copilot_document_analysis_provider_stub(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.copilot_provider.CopilotProviderClient.generate",
        lambda self, **kwargs: (
            '{"probable_document_type":"CND_MUNICIPAL","confidence":0.88,"evidence_snippets":["certidao negativa municipal"],'
            '"extracted_fields":{"municipio":"Anápolis"},"conflicts":[],"recommended_manual_action":"Conferir manualmente","not_conclusive_reason":null}'
        ),
    )
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DOCUMENT_ANALYSIS", "company_id": company_id, "message": "Analise o documento"},
        files={"document": ("doc.png", io.BytesIO(b"Numero 12345"), "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "DOCUMENT_ANALYSIS"
    assert payload["not_conclusive_reason"] is None


def test_copilot_document_analysis_provider_stub_accepts_markdown_json_block(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.copilot_provider.CopilotProviderClient.generate",
        lambda self, **kwargs: (
            "```json\n"
            '{"probable_document_type":"CND_MUNICIPAL","confidence":0.92,"evidence_snippets":["certidao negativa municipal"],'
            '"extracted_fields":{"municipio":"Anápolis"},"conflicts":[],"recommended_manual_action":"Conferir manualmente","not_conclusive_reason":null}\n'
            "```"
        ),
    )
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DOCUMENT_ANALYSIS", "company_id": company_id, "message": "Analise o documento"},
        files={"document": ("doc.pdf", io.BytesIO(b"Certidao Negativa Municipal"), "application/pdf")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "DOCUMENT_ANALYSIS"
    assert "Classificação em modo determinístico local" not in " ".join(payload.get("warnings") or [])


def test_copilot_view_role_is_authorized(client):
    admin_token = _login(client, "admin@example.com", "admin123")
    me = _get_me(client, admin_token)
    company_id = _create_company_bundle(me["org_id"])
    view_email, view_password = _create_view_user(me["org_id"])
    view_token = _login(client, view_email, view_password)

    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {view_token}"},
        data={"category": "COMPANY_SUMMARY", "company_id": company_id, "message": "Resuma"},
    )
    assert response.status_code == 200


def test_copilot_duvidas_diversas_shows_grounding_and_sources(client, monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_ENABLE_WEB_SEARCH", True)

    def _fake_generate(self, **kwargs):
        self._last_call_metadata = ProviderCallMetadata(
            requested_provider="gemini",
            used_provider="gemini",
            model="gemini-2.5-flash",
            category="DUVIDAS_DIVERSAS",
            web_search_requested=True,
            web_search_used=True,
            sources=[
                {
                    "title": "Prefeitura de Anápolis - TPI",
                    "url": "https://anapolis.go.gov.br/tpi",
                    "snippet": "Base legal municipal.",
                }
            ],
        )
        return "Resposta com grounding."

    monkeypatch.setattr("app.services.copilot_provider.CopilotProviderClient.generate", _fake_generate)

    admin_token = _login(client, "admin@example.com", "admin123")
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DUVIDAS_DIVERSAS", "message": "Quais regras de TPI em Anápolis? Cite fonte oficial."},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["grounding_used"] is True
    assert len(payload["sources"]) == 1
    assert payload["sources"][0]["url"] == "https://anapolis.go.gov.br/tpi"


def test_copilot_duvidas_diversas_missing_gemini_key_returns_friendly_error(client, monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")

    admin_token = _login(client, "admin@example.com", "admin123")
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DUVIDAS_DIVERSAS", "message": "O que é TPI?"},
    )
    assert response.status_code == 503
    assert "Chave Gemini ausente" in response.json()["detail"]


def test_copilot_duvidas_diversas_timeout_returns_controlled_error(client, monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_PROVIDER", "")

    def _raise_timeout(self, **kwargs):
        raise CopilotProviderError(
            code="PROVIDER_TIMEOUT",
            user_message="Tempo limite excedido ao consultar o provider.",
            provider="gemini",
        )

    monkeypatch.setattr("app.services.copilot_provider.CopilotProviderClient.generate", _raise_timeout)

    admin_token = _login(client, "admin@example.com", "admin123")
    response = client.post(
        "/api/v1/copilot/respond",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"category": "DUVIDAS_DIVERSAS", "message": "Quais regras atualizadas de TPI?"},
    )
    assert response.status_code == 504
    assert "Tempo limite" in response.json()["detail"]
