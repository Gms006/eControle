def test_healthz(client):
    response = client.get("/healthz")
    assert response.status_code == 200


def test_worker_health(client):
    login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    response = client.get("/api/v1/worker/health", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["db"] == "ok"
