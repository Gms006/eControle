from __future__ import annotations

from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_s7_full_ingest_companies_profiles_licences_taxes_processes(client: TestClient):
    token = _login(client, "dev@example.com", "dev123")

    payload = {
        "source": {"type": "spreadsheet_export", "name": "FULL", "version": "test"},
        "org": {"slug": "neto-contabilidade"},
        "companies": [
            {"cnpj": "12.345.678/0001-99", "razao_social": "Empresa Full LTDA", "municipio": "Anápolis", "uf": "GO"}
        ],
        "licences": [
            {"cnpj": "12.345.678/0001-99", "municipio": "ANÁPOLIS", "cercon": "Sujeito", "alvara_funcionamento": "*"}
        ],
        "taxes": [
            {"cnpj": "12.345.678/0001-99", "taxa_funcionamento": "Em aberto", "status_taxas": "Irregular"}
        ],
        "processes": [
            {
                "cnpj": "12.345.678/0001-99",
                "process_type": "DIVERSOS",
                "protocolo": "0001/2026",
                "situacao": "EM ANÁLISE",
                "obs": "Teste",
                "extra": {"foo": "bar"},
            }
        ],
    }

    r = client.post("/api/v1/ingest/run", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200

