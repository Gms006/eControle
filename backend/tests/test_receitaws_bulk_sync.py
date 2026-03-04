from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_profile import CompanyProfile
from app.models.org import Org
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.models.role import Role
from app.models.user import User
from app.services.receitaws_bulk_sync import diff_and_apply


def _login(client, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _create_view_user() -> None:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "VIEW").first()
        if not role:
            role = Role(name="VIEW")
            db.add(role)
            db.commit()
            db.refresh(role)
        org = db.query(Org).first()
        if not org:
            org = Org(name="Test Org", slug="test-org")
            db.add(org)
            db.commit()
            db.refresh(org)
        user = User(
            email="view-bulk@example.com",
            hashed_password=hash_password("view123"),
            org_id=org.id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
    finally:
        db.close()


def test_receitaws_bulk_sync_start_requires_dev_role(client):
    _create_view_user()
    token = _login(client, "view-bulk@example.com", "view123")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/dev/receitaws/bulk-sync/start",
        headers=headers,
        json={"password": "view123", "dry_run": True, "only_missing": True},
    )
    assert response.status_code == 403


def test_receitaws_bulk_sync_start_validates_password(client):
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/dev/receitaws/bulk-sync/start",
        headers=headers,
        json={"password": "wrong", "dry_run": True, "only_missing": True},
    )
    assert response.status_code == 401


def test_receitaws_bulk_sync_start_creates_run_with_flags(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.dev_receitaws_bulk_sync.run_receitaws_bulk_sync_job",
        lambda _run_id: None,
    )
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/dev/receitaws/bulk-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": True, "only_missing": False},
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    db = SessionLocal()
    try:
        run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        assert run is not None
        assert run.dry_run is True
        assert run.only_missing is False
        assert run.status in {"queued", "running", "completed"}
    finally:
        db.close()

    status_response = client.get(f"/api/v1/dev/receitaws/bulk-sync/{run_id}", headers=headers)
    assert status_response.status_code == 200
    payload = status_response.json()
    assert payload["run_id"] == run_id
    assert payload["dry_run"] is True
    assert payload["only_missing"] is False


def test_receitaws_bulk_sync_start_blocks_parallel_runs(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.dev_receitaws_bulk_sync.run_receitaws_bulk_sync_job",
        lambda _run_id: None,
    )
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/api/v1/dev/receitaws/bulk-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": True, "only_missing": True},
    )
    assert first.status_code == 200
    run_id = first.json()["run_id"]

    db = SessionLocal()
    try:
        run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        run.status = "running"
        db.commit()
    finally:
        db.close()

    second = client.post(
        "/api/v1/dev/receitaws/bulk-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": False, "only_missing": False},
    )
    assert second.status_code == 409

    active = client.get("/api/v1/dev/receitaws/bulk-sync/active", headers=headers)
    assert active.status_code == 200
    assert active.json()["run_id"] == run_id


def test_diff_and_apply_dry_run_does_not_persist_and_only_missing_respected(client):
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        company = Company(
            org_id=org.id,
            cnpj="12345678000199",
            razao_social="Empresa Original",
            nome_fantasia="Fantasia",
            municipio="Goiania",
            uf="GO",
        )
        profile = CompanyProfile(
            org_id=org.id,
            company_id=company.id,
            porte="ME",
            cnaes_principal=[{"code": "01", "text": "Teste"}],
            cnaes_secundarios=[{"code": "99", "text": "Existente"}],
            raw={"mei": False, "mei_optante": False},
        )
        db.add(company)
        db.flush()
        profile.company_id = company.id
        db.add(profile)
        db.commit()
        db.refresh(company)
        db.refresh(profile)

        mapped_payload = {
            "company.razao_social": "Empresa Nova",
            "company.nome_fantasia": "Fantasia Nova",
            "company.municipio": "Anapolis",
            "company.uf": "GO",
            "profile.porte": "EPP",
            "profile.cnaes_principal": [{"code": "02", "text": "Novo"}],
            "profile.cnaes_secundarios": [{"code": "03", "text": "Sec"}],
            "profile.raw.mei": True,
            "profile.raw.mei_optante": True,
        }

        dry_result = diff_and_apply(
            company=company,
            profile=profile,
            mapped_payload=mapped_payload,
            dry_run=True,
            only_missing=False,
        )
        assert dry_result["applied"] is True
        assert company.razao_social == "Empresa Original"
        assert profile.porte == "ME"

        only_missing_result = diff_and_apply(
            company=company,
            profile=profile,
            mapped_payload=mapped_payload,
            dry_run=False,
            only_missing=True,
        )
        assert only_missing_result["skipped"] is True
        assert company.razao_social == "Empresa Original"
        assert profile.porte == "ME"

        company.nome_fantasia = None
        profile.cnaes_secundarios = []
        profile.raw = {"mei_optante": False}
        apply_missing_result = diff_and_apply(
            company=company,
            profile=profile,
            mapped_payload=mapped_payload,
            dry_run=False,
            only_missing=True,
        )
        assert apply_missing_result["applied"] is True
        assert company.nome_fantasia == "Fantasia Nova"
        assert profile.cnaes_secundarios == [{"code": "03", "text": "Sec"}]
        assert profile.raw.get("mei") is True
    finally:
        db.close()
