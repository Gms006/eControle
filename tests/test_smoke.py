from __future__ import annotations

from fastapi.testclient import TestClient

from tests.test_api_v1 import admin_token, client


def test_smoke_healthz(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_smoke_empresas_list(client: TestClient, admin_token: str) -> None:
    response = client.get(
        "/api/v1/empresas",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"page": 1, "size": 1, "sort": "-updated_at"},
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"items", "total", "page", "size"}
    assert body["page"] == 1
