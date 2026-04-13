from __future__ import annotations

import pytest

from app.core.config import settings
from app.services.copilot_provider import CopilotProviderClient, CopilotProviderError
from app.services.copilot_web_search import should_search_web


@pytest.fixture(autouse=True)
def _provider_defaults(monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_MODEL", "gemini-2.5-flash")
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_TIMEOUT_SECONDS", 60)
    monkeypatch.setattr(settings, "COPILOT_PROVIDER_ENABLE_WEB_SEARCH", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_BASE_URL", "http://127.0.0.1:11434")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_MODEL", "gemma3:4b")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_TIMEOUT_SECONDS", 60)


def test_provider_reads_expected_envs():
    client = CopilotProviderClient()
    assert client.provider == "gemini"
    assert client.model == "gemini-2.5-flash"
    assert client.timeout == 60
    assert client.enable_web_search is True
    assert client.gemini_api_key == "fake-key"
    assert client.fallback_provider == "ollama"
    assert client.fallback_model == "gemma3:4b"
    assert client.fallback_base_url == "http://127.0.0.1:11434"


def test_provider_uses_gemini_when_primary_succeeds(monkeypatch):
    called = []

    def _fake_generate_by_provider(self, **kwargs):
        called.append(kwargs["provider"])
        return "ok-gemini", [], kwargs.get("enable_web_search", False)

    monkeypatch.setattr(CopilotProviderClient, "_generate_by_provider", _fake_generate_by_provider)
    client = CopilotProviderClient()
    response = client.generate(prompt="teste", category="DUVIDAS_DIVERSAS", enable_web_search=True, require_provider=True)
    assert response == "ok-gemini"
    assert called == ["gemini"]
    meta = client.last_call_metadata()
    assert meta["used_provider"] == "gemini"


def test_provider_uses_fallback_ollama_when_primary_fails(monkeypatch):
    called = []

    def _fake_generate_by_provider(self, **kwargs):
        called.append(kwargs["provider"])
        if kwargs["provider"] == "gemini":
            raise CopilotProviderError(
                code="PROVIDER_UNAVAILABLE",
                user_message="Provider temporariamente indisponível. Tente novamente.",
                provider="gemini",
            )
        return "ok-ollama", [], False

    monkeypatch.setattr(CopilotProviderClient, "_generate_by_provider", _fake_generate_by_provider)
    client = CopilotProviderClient()
    response = client.generate(prompt="teste", category="DUVIDAS_DIVERSAS", require_provider=True)
    assert response == "ok-ollama"
    assert called == ["gemini", "ollama"]
    meta = client.last_call_metadata()
    assert meta["used_provider"] == "ollama"
    assert meta["fallback_triggered"] is True
    assert meta["fallback_reason"] == "PROVIDER_UNAVAILABLE"


def test_provider_returns_controlled_error_when_primary_and_fallback_fail(monkeypatch):
    def _fake_generate_by_provider(self, **kwargs):
        raise CopilotProviderError(
            code="PROVIDER_UNAVAILABLE",
            user_message="Provider temporariamente indisponível. Tente novamente.",
            provider=kwargs["provider"],
        )

    monkeypatch.setattr(CopilotProviderClient, "_generate_by_provider", _fake_generate_by_provider)
    client = CopilotProviderClient()
    with pytest.raises(CopilotProviderError) as exc:
        client.generate(prompt="teste", category="DUVIDAS_DIVERSAS", require_provider=True)
    assert exc.value.code == "PROVIDER_FALLBACK_EXHAUSTED"


def test_provider_missing_gemini_key_raises_controlled_error(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_PROVIDER", "")
    client = CopilotProviderClient()
    with pytest.raises(CopilotProviderError) as exc:
        client.generate(prompt="teste", category="DUVIDAS_DIVERSAS", require_provider=True)
    assert exc.value.code == "GEMINI_API_KEY_MISSING"


def test_provider_rate_limit_error_is_propagated(monkeypatch):
    def _raise_rate_limit(self, **kwargs):
        raise CopilotProviderError(
            code="PROVIDER_RATE_LIMIT",
            user_message="Limite de requisições do provider atingido no momento.",
            provider=kwargs["provider"],
        )

    monkeypatch.setattr(CopilotProviderClient, "_generate_by_provider", _raise_rate_limit)
    monkeypatch.setattr(settings, "COPILOT_FALLBACK_PROVIDER", "")
    client = CopilotProviderClient()
    with pytest.raises(CopilotProviderError) as exc:
        client.generate(prompt="teste", category="DUVIDAS_DIVERSAS", require_provider=True)
    assert exc.value.code == "PROVIDER_RATE_LIMIT"


def test_should_search_web_for_regulatory_and_temporal_questions():
    assert should_search_web("Quais regras atuais de TPI em Anápolis? Cite fonte oficial.") is True
    assert should_search_web("Para essa empresa, use apenas nosso cadastro interno e explique o score") is False
    assert should_search_web("Quando mudou a legislação municipal do CNAE de baixo risco?") is True
