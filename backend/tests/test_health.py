def test_healthz(client):
    response = client.get("/healthz")
    assert response.status_code == 200


def test_worker_health(client):
    response = client.get("/api/v1/worker/health")
    assert response.status_code == 200
