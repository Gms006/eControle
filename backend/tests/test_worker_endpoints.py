from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.org import Org
from app.models.licence_scan_run import LicenceScanRun
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.models.role import Role
from app.models.user import User
from app.models.tax_portal_sync_run import TaxPortalSyncRun


def _login(client, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _create_view_user() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "view-worker@example.com").first()
        if existing:
            return
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
        elif not org.slug:
            org.slug = "test-org"
            db.commit()

        user = User(
            email="view-worker@example.com",
            hashed_password=hash_password("view123"),
            org_id=org.id,
            is_active=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
    finally:
        db.close()


def _create_receitaws_run() -> str:
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        admin_user = db.query(User).filter(User.email == "admin@example.com").first()
        assert admin_user is not None

        run = ReceitaWSBulkSyncRun(
            org_id=org.id,
            started_by_user_id=admin_user.id,
            status="running",
            dry_run=True,
            only_missing=True,
            total=10,
            processed=4,
            ok_count=3,
            error_count=1,
            skipped_count=0,
            current_cnpj="12345678000199",
            errors=[{"cnpj": "12345678000199", "error": "Erro de teste"}],
            changes_summary={"field_counters": {"company.nome_fantasia": 2}},
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run.id
    finally:
        db.close()

def _create_tax_portal_run() -> str:
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        admin_user = db.query(User).filter(User.email == "admin@example.com").first()
        assert admin_user is not None

        run = TaxPortalSyncRun(
            org_id=org.id,
            started_by_user_id=admin_user.id,
            status="running",
            trigger_type="manual",
            dry_run=True,
            municipio="ANÁPOLIS",
            limit=5,
            total=5,
            processed=2,
            ok_count=1,
            error_count=1,
            skipped_count=3,
            relogin_count=1,
            current_cnpj="12345678000199",
            errors=[{"cnpj": "12345678000199", "error": "Erro de teste"}],
            summary={"filtered_out_count": 3},
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run.id
    finally:
        db.close()

def _create_licence_scan_run() -> str:
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        run = LicenceScanRun(
            org_id=org.id,
            status="running",
            total=4,
            processed=2,
            ok_count=2,
            error_count=0,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run.id
    finally:
        db.close()


def test_worker_health_returns_ok(client):
    token = _login(client, "admin@example.com", "admin123")
    response = client.get("/api/v1/worker/health", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["db"] == "ok"
    assert "receitaws_bulk_sync" in payload["jobs_supported"]
    assert "tax_portal_sync" in payload["jobs_supported"]
    assert "licence_scan_full" in payload["jobs_supported"]
    assert "licence_directory_watcher" in payload["watchers_supported"]


def test_worker_jobs_returns_receitaws_run_status(client):
    token = _login(client, "admin@example.com", "admin123")
    run_id = _create_receitaws_run()

    response = client.get(f"/api/v1/worker/jobs/{run_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] == run_id
    assert payload["job_type"] == "receitaws_bulk_sync"
    assert payload["source"] == "receitaws_bulk_sync_runs"
    assert payload["status"] == "running"
    assert payload["processed"] == 4
    assert payload["total"] == 10


def test_worker_endpoints_allow_view_role(client):
    _create_view_user()
    run_id = _create_receitaws_run()
    token = _login(client, "view-worker@example.com", "view123")
    headers = {"Authorization": f"Bearer {token}"}

    health = client.get("/api/v1/worker/health", headers=headers)
    assert health.status_code == 200

    status_response = client.get(f"/api/v1/worker/jobs/{run_id}", headers=headers)
    assert status_response.status_code == 200


def test_worker_jobs_returns_licence_scan_run_status(client):
    token = _login(client, "admin@example.com", "admin123")
    run_id = _create_licence_scan_run()

    response = client.get(f"/api/v1/worker/jobs/{run_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] == run_id
    assert payload["job_type"] == "licence_scan_full"
    assert payload["source"] == "licence_scan_runs"
    assert payload["status"] == "running"
    assert payload["processed"] == 2
    assert payload["total"] == 4


def test_worker_jobs_returns_tax_portal_run_status_with_summary_meta(client):
    token = _login(client, "admin@example.com", "admin123")
    run_id = _create_tax_portal_run()

    response = client.get(f"/api/v1/worker/jobs/{run_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] == run_id
    assert payload["job_type"] == "tax_portal_sync"
    assert payload["source"] == "tax_portal_sync_runs"
    assert payload["status"] == "running"
    assert payload["processed"] == 2
    assert payload["total"] == 5
    assert payload["errors"]
    assert payload["meta"]["dry_run"] is True
    assert payload["meta"]["trigger_type"] == "manual"
    assert payload["meta"]["municipio"] == "anapolis"
    assert payload["meta"]["limit"] == 5
    assert payload["meta"]["relogin_count"] == 1
    assert payload["meta"]["summary"]["filtered_out_count"] == 3
