from pathlib import Path

from app.core.security import hash_password
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _org_id(client, headers: dict[str, str]) -> str:
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()["org_id"]


def _create_view_user() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "view-upload@example.com").first()
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
            email="view-upload@example.com",
            hashed_password=hash_password("view123"),
            org_id=org.id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
    finally:
        db.close()


def _multipart_payload(company_id: str, files: list[tuple[str, tuple[str, bytes, str]]], metadata: list[tuple[str, str]]):
    payload = list(files)
    payload.append(("company_id", (None, company_id)))
    for licence_type, expires_at in metadata:
        payload.append(("licence_type", (None, licence_type)))
        payload.append(("expires_at", (None, expires_at)))
    return payload


def test_upload_bulk_saves_standardized_files(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="12345678000110",
        razao_social="Empresa Upload",
        fs_dirname="Empresa Upload",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    files = [
        ("items", ("doc-1.pdf", b"conteudo-um", "application/pdf")),
        ("items", ("doc-2.jpg", b"conteudo-dois", "image/jpeg")),
    ]
    multipart = _multipart_payload(
        company.id,
        files,
        [("ALVARA_FUNCIONAMENTO_CONDICIONADO", "2026-12-20"), ("ALVARA_BOMBEIROS", "2026-11-15")],
    )
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 200
    payload = response.json()
    assert payload["saved_count"] == 2
    assert all(item["ok"] for item in payload["results"])

    base = Path(tmp_path) / "Empresa Upload" / "Societário" / "Alvarás e Certidões"
    assert (base / "Alvará Funcionamento - Condicionado - Val 20.12.2026.pdf").exists()
    assert (base / "Alvará Bombeiros - Val 15.11.2026.jpg").exists()


def test_upload_bulk_supports_definitive_name(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="52345678000110",
        razao_social="Empresa Definitiva",
        fs_dirname="Empresa Definitiva",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    files = [("items", ("doc.pdf", b"conteudo", "application/pdf"))]
    multipart = _multipart_payload(company.id, files, [("ALVARA_FUNCIONAMENTO_DEFINITIVO", "")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 200
    payload = response.json()
    assert payload["saved_count"] == 1
    assert payload["results"][0]["ok"] is True

    base = Path(tmp_path) / "Empresa Definitiva" / "Societário" / "Alvarás e Certidões"
    assert (base / "Alvará Funcionamento - Definitivo.pdf").exists()


def test_upload_bulk_blocks_invalid_fs_dirname(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="22345678000110",
        razao_social="Empresa Invalida",
        fs_dirname="../escape",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    files = [("items", ("doc.pdf", b"conteudo", "application/pdf"))]
    multipart = _multipart_payload(company.id, files, [("CERCON", "2026-12-20")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 400


def test_upload_bulk_rejects_invalid_extension(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="32345678000110",
        razao_social="Empresa Extensao",
        fs_dirname="Empresa Extensao",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    files = [("items", ("doc.exe", b"conteudo", "application/octet-stream"))]
    multipart = _multipart_payload(company.id, files, [("CERCON", "2026-12-20")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 200
    payload = response.json()
    assert payload["saved_count"] == 0
    assert payload["results"][0]["ok"] is False


def test_upload_bulk_view_cannot_write(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    _create_view_user()
    token = _login(client, email="view-upload@example.com", password="view123")
    headers = {"Authorization": f"Bearer {token}"}

    files = [("items", ("doc.pdf", b"conteudo", "application/pdf"))]
    multipart = _multipart_payload("any-id", files, [("CERCON", "2026-12-20")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 403


def test_upload_bulk_fails_when_structured_layout_missing_expected_subdir(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="42345678000210",  # filial
        razao_social="Empresa Estruturada",
        fs_dirname="Empresa Estruturada",
        municipio="Goiânia",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    base = Path(tmp_path) / "Empresa Estruturada" / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Matriz").mkdir(parents=True, exist_ok=True)

    files = [("items", ("doc.pdf", b"conteudo", "application/pdf"))]
    multipart = _multipart_payload(company.id, files, [("CERCON", "2026-12-20")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 400
    assert "Structured layout detected" in response.json()["detail"]


def test_upload_bulk_uses_structured_subdir_when_available(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "EMPRESAS_ROOT_DIR", str(tmp_path))
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    org_id = _org_id(client, headers)

    db = SessionLocal()
    company = Company(
        org_id=org_id,
        cnpj="52345678000210",  # filial
        razao_social="Empresa Estruturada OK",
        fs_dirname="Empresa Estruturada OK",
        municipio="Goiânia",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    db.close()

    base = Path(tmp_path) / "Empresa Estruturada OK" / "Societário" / "Alvarás e Certidões"
    (base / "Goiânia - Filial").mkdir(parents=True, exist_ok=True)

    files = [("items", ("doc.pdf", b"conteudo", "application/pdf"))]
    multipart = _multipart_payload(company.id, files, [("CERCON", "2026-12-20")])
    response = client.post("/api/v1/licencas/upload-bulk", headers=headers, files=multipart)
    assert response.status_code == 200
    payload = response.json()
    assert payload["saved_count"] == 1
    assert (base / "Goiânia - Filial" / "Alvará Bombeiros - Val 20.12.2026.pdf").exists()
