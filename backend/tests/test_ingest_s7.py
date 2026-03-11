from __future__ import annotations

from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_s7_ingest_companies_idempotent_and_utf8(client: TestClient):
    token = _login(client, "dev@example.com", "dev123")

    payload = {
        "source": {
            "type": "spreadsheet_export",
            "name": "LISTA EMPRESAS - NETO CONTABILIDADE 2025",
            "version": "v1-to-v2-json",
            "generated_at": "2026-02-23T18:00:00Z",
        },
        "org": {"slug": "neto-contabilidade"},
        "companies": [
            {
                "cnpj": "10.259.622/0001-92",
                "razao_social": "LICENÇA AMBIENTAL – Anápolis – CONCLUÍDO",
                "fs_dirname": "LICENCA AMBIENTAL ANAPOLIS",
                "municipio": "Anápolis",
                "uf": "GO",
                "is_active": True,
            }
        ],
    }

    # Run 1
    r1 = client.post("/api/v1/ingest/run", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["dataset"] == "companies"
    assert j1["total"] == 1

    # Run 2 (should update, not duplicate)
    r2 = client.post("/api/v1/ingest/run", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["total"] == 1

    companies = client.get("/api/v1/companies", headers={"Authorization": f"Bearer {token}"})
    assert companies.status_code == 200
    assert len(companies.json()) == 1
    assert companies.json()[0]["fs_dirname"] == "LICENCA AMBIENTAL ANAPOLIS"


def test_s7_ingest_companies_accepts_alias_as_fs_dirname(client: TestClient):
    token = _login(client, "dev@example.com", "dev123")
    payload = {
        "source": {
            "type": "spreadsheet_export",
            "name": "LISTA EMPRESAS - NETO CONTABILIDADE 2025",
            "version": "v1-to-v2-json",
            "generated_at": "2026-02-23T18:00:00Z",
        },
        "org": {"slug": "neto-contabilidade"},
        "companies": [
            {
                "cnpj": "10.259.622/0001-93",
                "razao_social": "Empresa Alias",
                "alias": "PASTA ALIAS",
                "municipio": "Anápolis",
                "uf": "GO",
                "is_active": True,
            }
        ],
    }

    response = client.post("/api/v1/ingest/run", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    companies = client.get("/api/v1/companies", headers={"Authorization": f"Bearer {token}"})
    assert companies.status_code == 200
    matched = next(item for item in companies.json() if item["cnpj"] == "10259622000193")
    assert matched["fs_dirname"] == "PASTA ALIAS"
