from __future__ import annotations

from datetime import date, timedelta

import app.worker.watchers as watcher_module
from app.db.session import SessionLocal
from app.models.cnae_risk import CNAERisk
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_profile import CompanyProfile
from app.models.org import Org
from app.models.receitaws_bulk_sync_run import ReceitaWSBulkSyncRun
from app.models.user import User
from app.services.company_scoring import recalculate_company_score
from app.services.receitaws_bulk_sync import run_receitaws_bulk_sync_job
from app.worker.watchers import LICENCES_SUBDIR, run_scan_once


def _login(client, email: str = "admin@example.com", password: str = "admin123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _first_org(db) -> Org:
    org = db.query(Org).first()
    assert org is not None
    return org


def _ensure_cnae_risk(db, code: str, text: str = "Atividade teste", risk_tier: str = "LOW", base_weight: int = 10) -> None:
    existing = db.query(CNAERisk).filter(CNAERisk.cnae_code == code).first()
    if existing:
        existing.cnae_text = text
        existing.risk_tier = risk_tier
        existing.base_weight = base_weight
        existing.is_active = True
        return
    db.add(
        CNAERisk(
            cnae_code=code,
            cnae_text=text,
            risk_tier=risk_tier,
            base_weight=base_weight,
            sanitary_risk="LOW",
            fire_risk="LOW",
            environmental_risk="LOW",
            source="test",
            is_active=True,
        )
    )


def test_company_score_no_cnae_returns_no_cnae(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        company = Company(org_id=org.id, cnpj="10101010000101", razao_social="Sem CNAE")
        db.add(company)
        db.flush()
        db.add(CompanyProfile(org_id=org.id, company_id=company.id, raw={}))
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company.id).first()
        assert result["score_status"] == "NO_CNAE"
        assert profile is not None
        assert profile.score_status == "NO_CNAE"
        assert profile.score_urgencia == 0
        assert profile.risco_consolidado is None
        assert profile.score_updated_at is not None
    finally:
        db.close()


def test_company_score_unmapped_cnae_returns_unmapped(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        company = Company(org_id=org.id, cnpj="20202020000102", razao_social="CNAE sem mapeamento")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "99.99-9-99", "text": "Nao mapeado"}],
                raw={},
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "UNMAPPED_CNAE"
        profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company.id).first()
        assert profile is not None
        assert profile.score_status == "UNMAPPED_CNAE"
        assert profile.score_urgencia == 0
    finally:
        db.close()


def test_company_score_placeholder_cnae_is_treated_as_no_cnae(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        company = Company(org_id=org.id, cnpj="90909090000109", razao_social="Placeholder CNAE")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "Não informada", "text": "Nao informada"}],
                cnaes_secundarios=[{"code": "********", "text": "Nao informada"}],
                raw={},
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "NO_CNAE"
        assert result["cnae_codes"] == []
        assert result["matched_cnaes"] == 0
    finally:
        db.close()


def test_company_score_matches_equivalent_cnae_formats(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="MEDIUM", base_weight=35)
        company = Company(org_id=org.id, cnpj="21212121000121", razao_social="CNAE formato equivalente")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "5611201", "text": "Restaurantes e similares"}],
                cnaes_secundarios=[{"code": "56 11-2/01", "text": "Mesmo CNAE"}],
                raw={},
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "NO_LICENCE"
        assert result["matched_cnaes"] == 1
        assert result["cnae_codes"] == ["56.11-2-01"]
    finally:
        db.close()


def test_company_score_uses_highest_tier_and_weight_across_cnaes(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="HIGH", base_weight=55)
        _ensure_cnae_risk(db, "62.01-5-01", risk_tier="LOW", base_weight=10)
        company = Company(org_id=org.id, cnpj="91919191000191", razao_social="Mix CNAE")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "6201501", "text": "Software"}],
                cnaes_secundarios=[{"code": "5611201", "text": "Restaurante"}],
                raw={},
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "NO_LICENCE"
        assert result["risco_consolidado"] == "HIGH"
        assert result["score_urgencia"] == 55
    finally:
        db.close()


def test_company_score_mapped_cnae_without_licence_date_returns_no_licence(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="MEDIUM", base_weight=35)
        company = Company(org_id=org.id, cnpj="30303030000103", razao_social="Mapeada sem validade")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "56.11-2-01", "text": "Restaurantes e similares"}],
                raw={},
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "NO_LICENCE"
        profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company.id).first()
        assert profile is not None
        assert profile.risco_consolidado == "MEDIUM"
        assert profile.score_urgencia == 35
    finally:
        db.close()


def test_company_score_mapped_cnae_with_overdue_licence_increases_score(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "47.89-0-04", risk_tier="HIGH", base_weight=30)
        company = Company(org_id=org.id, cnpj="40404040000104", razao_social="Mapeada vencida")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "47.89-0-04", "text": "Comercio varejista de animais"}],
                raw={},
            )
        )
        db.add(
            CompanyLicence(
                org_id=org.id,
                company_id=company.id,
                cercon_valid_until=date.today() - timedelta(days=1),
            )
        )
        db.flush()

        result = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert result["score_status"] == "OK"
        profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company.id).first()
        assert profile is not None
        assert profile.risco_consolidado == "HIGH"
        assert profile.score_urgencia == 80
    finally:
        db.close()


def test_recalculate_after_catalog_update_changes_profile_snapshot(client):
    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="LOW", base_weight=10)
        company = Company(org_id=org.id, cnpj="92929292000192", razao_social="Recalculo Seed")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "56.11-2-01", "text": "Restaurantes"}],
                raw={},
            )
        )
        db.flush()

        first = recalculate_company_score(db, org.id, company.id)
        assert first["score_urgencia"] == 10
        assert first["risco_consolidado"] == "LOW"

        risk = db.query(CNAERisk).filter(CNAERisk.cnae_code == "56.11-2-01").first()
        assert risk is not None
        risk.risk_tier = "HIGH"
        risk.base_weight = 55

        second = recalculate_company_score(db, org.id, company.id)
        db.commit()

        assert second["score_urgencia"] == 55
        assert second["risco_consolidado"] == "HIGH"
        assert second["changed"] is True
    finally:
        db.close()


def test_patch_company_recalculates_score(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="HIGH", base_weight=45)
        db.commit()
    finally:
        db.close()

    created = client.post(
        "/api/v1/companies",
        headers=headers,
        json={"cnpj": "50505050000105", "razao_social": "Patch Empresa"},
    )
    assert created.status_code == 200
    company_id = created.json()["id"]

    patched = client.patch(
        f"/api/v1/companies/{company_id}",
        headers=headers,
        json={"cnaes_principal": [{"code": "56.11-2-01", "text": "Restaurantes e similares"}]},
    )
    assert patched.status_code == 200
    payload = patched.json()
    assert payload["score_status"] == "NO_LICENCE"
    assert payload["score_urgencia"] == 45
    assert payload["risco_consolidado"] == "HIGH"


def test_patch_licence_item_recalculates_score(client):
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        org = _first_org(db)
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="MEDIUM", base_weight=20)
        company = Company(org_id=org.id, cnpj="60606060000106", razao_social="Patch Licenca")
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "56.11-2-01", "text": "Restaurantes e similares"}],
                raw={},
            )
        )
        licence = CompanyLicence(org_id=org.id, company_id=company.id, cercon="possui")
        db.add(licence)
        db.flush()
        licence_id = licence.id
        db.commit()
    finally:
        db.close()

    expired_date = (date.today() - timedelta(days=2)).isoformat()
    response = client.patch(
        f"/api/v1/licencas/{licence_id}/item",
        headers=headers,
        json={"field": "cercon", "status": "vencido", "validade": expired_date},
    )
    assert response.status_code == 200

    db = SessionLocal()
    try:
        profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == response.json()["company_id"]).first()
        assert profile is not None
        assert profile.score_status == "OK"
        assert profile.score_urgencia == 70
    finally:
        db.close()


def test_bulk_sync_recalculates_score_when_cnae_changes(client, monkeypatch):
    db = SessionLocal()
    try:
        org = _first_org(db)
        user = db.query(User).filter(User.org_id == org.id).first()
        assert user is not None
        _ensure_cnae_risk(db, "56.11-2-01", risk_tier="LOW", base_weight=40)
        company = Company(org_id=org.id, cnpj="70707070000107", razao_social="Bulk Score")
        db.add(company)
        db.flush()
        db.add(CompanyProfile(org_id=org.id, company_id=company.id, cnaes_principal=[], cnaes_secundarios=[], raw={}))
        run = ReceitaWSBulkSyncRun(
            org_id=org.id,
            started_by_user_id=user.id,
            status="queued",
            dry_run=False,
            only_missing=False,
            total=0,
            processed=0,
            ok_count=0,
            error_count=0,
            skipped_count=0,
            errors=[],
            changes_summary={},
        )
        db.add(run)
        db.commit()
        run_id = run.id
    finally:
        db.close()

    async def _fake_fetch(_cnpj: str):
        return {
            "status": "OK",
            "nome": "Bulk Score",
            "fantasia": "Bulk Score",
            "porte": "ME",
            "municipio": "Anápolis",
            "uf": "GO",
            "atividade_principal": [{"code": "5611201", "text": "Restaurantes e similares"}],
            "atividades_secundarias": [],
        }

    monkeypatch.setattr("app.services.receitaws_bulk_sync.fetch_receitaws_payload", _fake_fetch)
    run_receitaws_bulk_sync_job(run_id)

    db = SessionLocal()
    try:
        run = db.query(ReceitaWSBulkSyncRun).filter(ReceitaWSBulkSyncRun.id == run_id).first()
        assert run is not None
        assert run.status == "completed"
        profile = db.query(CompanyProfile).filter(CompanyProfile.org_id == run.org_id).first()
        assert profile is not None
        assert profile.score_status == "NO_LICENCE"
        assert profile.score_urgencia == 40
    finally:
        db.close()


def test_watcher_recalculates_only_when_projection_changes(client, tmp_path, monkeypatch):
    db = SessionLocal()
    call_counter = {"count": 0}
    try:
        monkeypatch.setattr(watcher_module, "SessionLocal", lambda: db)
        monkeypatch.setattr(db, "close", lambda: None)

        org = _first_org(db)
        _ensure_cnae_risk(db, "42.11-1-01", risk_tier="LOW", base_weight=15)
        company = Company(
            org_id=org.id,
            cnpj="80808080000108",
            razao_social="Watcher Score",
            fs_dirname="Watcher Score",
            municipio="Goiania",
        )
        db.add(company)
        db.flush()
        db.add(
            CompanyProfile(
                org_id=org.id,
                company_id=company.id,
                cnaes_principal=[{"code": "42.11-1-01", "text": "Construcao"}],
                raw={},
            )
        )
        db.add(CompanyLicence(org_id=org.id, company_id=company.id, municipio="Goiania", raw={}))
        db.commit()

        def _fake_recalculate(*_args, **_kwargs):
            call_counter["count"] += 1
            return {"updated": True, "changed": True}

        monkeypatch.setattr(watcher_module, "recalculate_company_score", _fake_recalculate)

        base = tmp_path / "Watcher Score" / LICENCES_SUBDIR
        base.mkdir(parents=True, exist_ok=True)
        (base / "ALVARA_BOMBEIROS - Val 25.12.2027.pdf").write_bytes(b"watcher-score")

        first = run_scan_once(str(tmp_path))
        second = run_scan_once(str(tmp_path))

        assert first["processed"] == 1
        assert second["processed"] == 0
        assert call_counter["count"] == 1
    finally:
        db.close()
