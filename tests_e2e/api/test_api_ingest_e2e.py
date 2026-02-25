from __future__ import annotations

import os
from datetime import datetime, timezone

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


def _source_block(name: str) -> dict:
    return {
        "type": "e2e",
        "name": name,
        "version": "s7-e2e",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


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
    if response.status_code != 200:
        pytest.fail(
            "Falha no login E2E em /api/v1/auth/login "
            f"(status={response.status_code}) para ECONTROLE_EMAIL='{email}'. "
            "Defina ECONTROLE_EMAIL/ECONTROLE_PASSWORD com um usuario real do banco "
            "(com role DEV para os testes de ingest). "
            f"Resposta: {response.text}"
        )
    payload = response.json()
    token = payload.get("access_token")
    assert token, payload
    return token


def test_e2e_login_and_me(client: httpx.Client, access_token: str) -> None:
    response = client.get("/api/v1/auth/me", headers=_auth_headers(access_token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data.get("email")
    assert "roles" in data


def test_e2e_ingest_run_idempotent_and_separate_ingests(
    client: httpx.Client,
    access_token: str,
) -> None:
    headers = _auth_headers(access_token)
    cnpj = "12.345.678/0001-99"

    run_payload = {
        "source": _source_block("e2e-ingest-run"),
        "org": {"slug": "neto-contabilidade"},
        "companies": [
            {
                "cnpj": cnpj,
                "razao_social": "Empresa E2E Runner Ltda",
                "nome_fantasia": "Empresa E2E Runner",
                "municipio": "Anápolis",
                "uf": "GO",
                "is_active": True,
            }
        ],
        "licences": [
            {
                "cnpj": cnpj,
                "municipio": "Anápolis",
                "alvara_funcionamento": "Possui",
                "cercon": "Sujeito",
            }
        ],
        "taxes": [
            {
                "cnpj": cnpj,
                "taxa_funcionamento": "Em aberto",
                "status_taxas": "Irregular",
            }
        ],
        "processes": [
            {
                "cnpj": cnpj,
                "process_type": "ALVARA",
                "protocolo": "E2E-0001/2026",
                "municipio": "Anápolis",
                "situacao": "EM ANALISE",
                "obs": "Seed e2e",
            }
        ],
    }

    response_1 = client.post("/api/v1/ingest/run", json=run_payload, headers=headers)
    assert response_1.status_code == 200, response_1.text
    data_1 = response_1.json()
    assert data_1["dataset"] == "companies"
    assert data_1["total"] == 1

    response_2 = client.post("/api/v1/ingest/run", json=run_payload, headers=headers)
    assert response_2.status_code == 200, response_2.text
    data_2 = response_2.json()
    assert data_2["dataset"] == "companies"
    assert data_2["total"] == 1

    licences_payload = {
        "source": _source_block("e2e-licences"),
        "org": {"slug": "neto-contabilidade"},
        "licences": [
            {
                "cnpj": cnpj,
                "municipio": "Anápolis",
                "alvara_funcionamento": "Possui",
                "alvara_vig_sanitaria": "Possui",
            }
        ],
    }
    licences_resp = client.post("/api/v1/ingest/licences", json=licences_payload, headers=headers)
    assert licences_resp.status_code == 200, licences_resp.text
    assert licences_resp.json()["dataset"] == "licences"

    taxes_payload = {
        "source": _source_block("e2e-taxes"),
        "org": {"slug": "neto-contabilidade"},
        "taxes": [
            {
                "cnpj": cnpj,
                "taxa_funcionamento": "Em aberto",
                "taxa_publicidade": "Quitado",
                "status_taxas": "Irregular",
            }
        ],
    }
    taxes_resp = client.post("/api/v1/ingest/taxes", json=taxes_payload, headers=headers)
    assert taxes_resp.status_code == 200, taxes_resp.text
    assert taxes_resp.json()["dataset"] == "taxes"

    processes_payload = {
        "source": _source_block("e2e-processes"),
        "org": {"slug": "neto-contabilidade"},
        "processes": [
            {
                "cnpj": cnpj,
                "process_type": "ALVARA",
                "protocolo": "E2E-0002/2026",
                "municipio": "Anápolis",
                "situacao": "EM ANALISE",
            }
        ],
    }
    processes_resp = client.post("/api/v1/ingest/processes", json=processes_payload, headers=headers)
    assert processes_resp.status_code == 200, processes_resp.text
    assert processes_resp.json()["dataset"] == "processes"
