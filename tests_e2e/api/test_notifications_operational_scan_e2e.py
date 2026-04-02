from __future__ import annotations

import os

import httpx
import pytest


pytestmark = pytest.mark.e2e


def _require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        pytest.fail(f"Variável de ambiente obrigatória ausente: {name}")
    return value


def _api_base_url() -> str:
    return (os.getenv("ECONTROLE_E2E_API_BASE_URL") or "http://127.0.0.1:8020").rstrip("/")


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def credentials() -> tuple[str, str]:
    return _require_env("ECONTROLE_EMAIL"), _require_env("ECONTROLE_PASSWORD")


@pytest.fixture(scope="session")
def client() -> httpx.Client:
    with httpx.Client(base_url=_api_base_url(), timeout=30.0) as http:
        yield http


@pytest.fixture(scope="session")
def access_token(client: httpx.Client, credentials: tuple[str, str]) -> str:
    email, password = credentials
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    payload = response.json()
    token = payload.get("access_token")
    assert token, payload
    return token


def test_e2e_notifications_operational_scan_and_worker_job(client: httpx.Client, access_token: str) -> None:
    headers = _auth_headers(access_token)
    start = client.post("/api/v1/notificacoes/scan-operacional", headers=headers)
    assert start.status_code == 200, start.text
    run_id = start.json().get("run_id")
    assert run_id

    status = client.get(f"/api/v1/worker/jobs/{run_id}", headers=headers)
    assert status.status_code == 200, status.text
    payload = status.json()
    assert payload.get("job_id") == run_id
    assert payload.get("job_type") == "notification_operational_scan"
