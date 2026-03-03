def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_process_situacao_is_saved_as_canonical(client):
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    company = client.post(
        "/api/v1/companies",
        headers=headers,
        json={
            "cnpj": "12.345.678/0001-66",
            "razao_social": "Empresa Processo",
            "municipio": "ANAPOLIS",
            "uf": "GO",
        },
    )
    assert company.status_code == 200
    company_id = company.json()["id"]

    created = client.post(
        "/api/v1/processos",
        headers=headers,
        json={
            "company_id": company_id,
            "process_type": "DIVERSOS",
            "protocolo": "P-2026-0001",
            "situacao": "EM ANÁLISE",
        },
    )
    assert created.status_code == 200
    assert created.json()["situacao"] == "em_analise"

    updated = client.patch(
        f"/api/v1/processos/{created.json()['id']}",
        headers=headers,
        json={"situacao": "Concluído"},
    )
    assert updated.status_code == 200
    assert updated.json()["situacao"] == "concluido"


def test_meta_enums_exposes_process_status_labels(client):
    token = _login(client, "admin@example.com", "admin123")
    response = client.get(
        "/api/v1/meta/enums",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    values = {item["value"]: item["label"] for item in payload.get("process_situacoes", [])}
    assert values["em_analise"] == "Em análise"
    assert isinstance(payload.get("operacoes_diversos"), list)
    assert isinstance(payload.get("orgaos_diversos"), list)
    assert isinstance(payload.get("alvaras_funcionamento"), list)
    assert isinstance(payload.get("servicos_sanitarios"), list)
    assert isinstance(payload.get("notificacoes_sanitarias"), list)


def test_process_rejects_invalid_situacao(client):
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    company = client.post(
        "/api/v1/companies",
        headers=headers,
        json={
            "cnpj": "12.345.678/0001-67",
            "razao_social": "Empresa Processo 2",
            "municipio": "GOIANIA",
            "uf": "GO",
        },
    )
    assert company.status_code == 200

    response = client.post(
        "/api/v1/processos",
        headers=headers,
        json={
            "company_id": company.json()["id"],
            "process_type": "DIVERSOS",
            "protocolo": "P-2026-0002",
            "situacao": "valor_invalido",
        },
    )
    assert response.status_code == 422
