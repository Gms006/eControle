from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_lookup_receitaws_uses_brasilapi_fallback(client: TestClient, monkeypatch):
    async def _fail_receitaws(_cnpj: str):
        raise RuntimeError("receitaws offline")

    async def _ok_brasilapi(_cnpj: str):
        return {
            "razao_social": "Empresa Fallback Ltda",
            "nome_fantasia": "Empresa Fallback",
            "porte": "ME",
            "municipio": "Anápolis",
            "uf": "GO",
            "email": "contato@fallback.com.br",
            "ddd_telefone_1": "(62) 99999-0000",
            "cnae_fiscal": "47.11-3-02",
            "cnae_fiscal_descricao": "Comércio varejista",
            "cnaes_secundarios": [{"codigo": "56.11-2-01", "descricao": "Restaurantes"}],
        }

    monkeypatch.setattr("app.api.v1.endpoints.lookups.fetch_receitaws_payload", _fail_receitaws)
    monkeypatch.setattr("app.api.v1.endpoints.lookups.fetch_brasilapi_payload", _ok_brasilapi)

    token = _login(client, "admin@example.com", "admin123")
    response = client.get(
        "/api/v1/lookups/receitaws/12345678000190",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["cnpj"] == "12345678000190"
    assert payload["razao_social"] == "Empresa Fallback LTDA"
    assert payload["municipio"] == "ANÁPOLIS"
    assert payload["uf"] == "GO"
    assert payload["status"] == "success"
