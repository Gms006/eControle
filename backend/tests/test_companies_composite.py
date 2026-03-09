def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_create_company_composite_with_taxes_and_licences(client):
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/companies/composite",
        headers=headers,
        json={
            "company": {
                "cnpj": "12.345.678/0001-55",
                "razao_social": "Empresa Composite",
                "fs_dirname": "Empresa Composite Pasta",
                "municipio": "ANAPOLIS",
                "uf": "GO",
            },
            "profile": {
                "porte": "ME",
                "mei": False,
                "endereco_fiscal": False,
            },
            "licences": {
                "alvara_sanitario": True,
                "alvara_funcionamento": False,
                "cercon": True,
                "licenca_ambiental": False,
                "certidao_uso_solo": True,
                "nao_necessita": False,
            },
            "taxes": {
                "funcionamento": True,
                "publicidade": False,
                "vigilancia_sanitaria": True,
                "localizacao_instalacao": False,
                "ocupacao_area_publica": False,
                "tpi": True,
                "vencimento_tpi": "10/10",
            },
        },
    )
    assert response.status_code == 200
    company_id = response.json()["id"]
    assert response.json()["fs_dirname"] == "Empresa Composite Pasta"

    licences = client.get("/api/v1/licencas", headers=headers)
    assert licences.status_code == 200
    company_lic = next(item for item in licences.json() if item["company_id"] == company_id)
    assert company_lic["alvara_vig_sanitaria"] == "sujeito"
    assert company_lic["alvara_funcionamento"] == "isento"
    assert company_lic["cercon"] == "sujeito"

    taxes = client.get("/api/v1/taxas", headers=headers)
    assert taxes.status_code == 200
    company_tax = next(item for item in taxes.json() if item["company_id"] == company_id)
    assert company_tax["taxa_funcionamento"] == "em_aberto"
    assert company_tax["taxa_publicidade"] == "isento"
    assert company_tax["tpi"] == "em_aberto"
