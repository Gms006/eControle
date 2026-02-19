def test_refresh_and_logout(client):
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert login_response.status_code == 200
    tokens = login_response.json()

    refresh_response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["refresh_token"] != tokens["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout", json={"refresh_token": refreshed["refresh_token"]}
    )
    assert logout_response.status_code == 200

    refresh_again = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refreshed["refresh_token"]}
    )
    assert refresh_again.status_code == 401
