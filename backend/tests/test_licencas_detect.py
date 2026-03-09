from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _create_view_user() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "view-detect@example.com").first()
        if existing:
            return
        role = db.query(Role).filter(Role.name == "VIEW").first()
        if not role:
            role = Role(name="VIEW")
            db.add(role)
            db.commit()
            db.refresh(role)
        org = db.query(Org).first()
        user = User(
            email="view-detect@example.com",
            hashed_password=hash_password("view123"),
            org_id=org.id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
    finally:
        db.close()


def _detect(client, token: str, files: list[str]):
    multipart = [("items", (name, b"noop", "application/pdf")) for name in files]
    return client.post("/api/v1/licencas/detect", headers={"Authorization": f"Bearer {token}"}, files=multipart)


def test_detect_parses_official_patterns(client):
    token = _login(client)
    response = _detect(
        client,
        token,
        [
            "Dispensa Sanitária - Val 31.12.2026.pdf",
            "Alvará Funcionamento - Provisório - Val 20.12.2026.pdf",
            "Dispensa Ambiental - Val 05/01/2027.pdf",
        ],
    )
    assert response.status_code == 200
    items = response.json()["results"]
    assert items[0]["suggested_group"] == "SANITARIA"
    assert items[0]["suggested_document_kind"] == "DISPENSA_SANITARIA"
    assert items[0]["canonical_filename"] == "Dispensa Sanitária - Val 31.12.2026.pdf"
    assert items[1]["suggested_group"] == "FUNCIONAMENTO"
    assert items[1]["suggested_document_kind"] == "ALVARA_FUNCIONAMENTO_PROVISORIO"
    assert items[2]["suggested_group"] == "AMBIENTAL"
    assert items[2]["suggested_document_kind"] == "DISPENSA_AMBIENTAL"
    assert items[2]["canonical_filename"] == "Dispensa Ambiental - Val 05.01.2027.pdf"


def test_detect_definitive_returns_null_expiry(client):
    token = _login(client)
    response = _detect(client, token, ["Dispensa Sanitária - Definitivo.pdf"])
    assert response.status_code == 200
    item = response.json()["results"][0]
    assert item["suggested_group"] == "SANITARIA"
    assert item["is_definitive"] is True
    assert item["suggested_expires_at"] is None
    assert item["canonical_filename"] == "Dispensa Sanitária - Definitivo.pdf"


def test_detect_prefers_date_near_val_token(client):
    token = _login(client)
    response = _detect(client, token, ["Alvará Vig Sanitária 15/01/2026 - Val 20-12-2027 - ref 01.01.2028.pdf"])
    assert response.status_code == 200
    item = response.json()["results"][0]
    assert item["suggested_group"] == "SANITARIA"
    assert item["suggested_expires_at"] == "2027-12-20"
    assert item["canonical_filename"] == "Alvará Vig Sanitária - Val 20.12.2027.pdf"


def test_detect_blocks_view_role(client):
    _create_view_user()
    token = _login(client, email="view-detect@example.com", password="view123")
    response = _detect(client, token, ["Alvará Bombeiros - Val 10.10.2026.pdf"])
    assert response.status_code == 403
