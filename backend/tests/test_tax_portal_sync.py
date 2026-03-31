from __future__ import annotations

from datetime import datetime

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_tax import CompanyTax
from app.models.org import Org
from app.models.tax_portal_sync_run import TaxPortalSyncRun
from app.models.user import User
from app.services.tax_portal_runtime import interpretar_parcelas
from app.services.tax_portal_sync import (
    _merge_summary,
    _resolve_tax_field_value,
    apply_tax_portal_result_to_company_tax,
)


def _login(client, email: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth_headers_org(client) -> tuple[dict[str, str], str]:
    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    return headers, me.json()["org_id"]


def test_tax_portal_sync_start_and_status(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.dev_tax_portal_sync.run_tax_portal_sync_job",
        lambda _run_id: None,
    )

    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/dev/taxas/portal-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": True, "municipio": "ANÁPOLIS", "limit": 5},
    )
    assert response.status_code == 200
    run_id = response.json()["run_id"]

    db = SessionLocal()
    try:
        run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
        assert run is not None
        assert run.dry_run is True
        assert run.municipio == "anapolis"
        assert run.limit == 5
        assert run.status in {"queued", "running", "completed"}
    finally:
        db.close()

    status_response = client.get(f"/api/v1/dev/taxas/portal-sync/{run_id}", headers=headers)
    assert status_response.status_code == 200
    payload = status_response.json()
    assert payload["run_id"] == run_id
    assert payload["dry_run"] is True
    assert payload["municipio"] == "anapolis"
    assert payload["limit"] == 5


def test_tax_portal_sync_start_blocks_parallel_runs(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.endpoints.dev_tax_portal_sync.run_tax_portal_sync_job",
        lambda _run_id: None,
    )

    token = _login(client, "admin@example.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/api/v1/dev/taxas/portal-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": True, "municipio": "ANÁPOLIS", "limit": 5},
    )
    assert first.status_code == 200
    run_id = first.json()["run_id"]

    db = SessionLocal()
    try:
        run = db.query(TaxPortalSyncRun).filter(TaxPortalSyncRun.id == run_id).first()
        assert run is not None
        run.status = "running"
        db.commit()
    finally:
        db.close()

    second = client.post(
        "/api/v1/dev/taxas/portal-sync/start",
        headers=headers,
        json={"password": "admin123", "dry_run": False, "municipio": "ANÁPOLIS", "limit": 10},
    )
    assert second.status_code == 409

    active = client.get("/api/v1/dev/taxas/portal-sync/active", headers=headers)
    assert active.status_code == 200
    assert active.json()["run_id"] == run_id


def test_resolve_tax_field_value_preserves_star_paid_and_non_payable_rule():
    assert _resolve_tax_field_value("*", None) == "*"
    assert _resolve_tax_field_value("*", "2025 em aberto") == "2025 em aberto"
    assert _resolve_tax_field_value(None, None) is None
    assert _resolve_tax_field_value("", None) == ""
    assert _resolve_tax_field_value("Isento", None) == "Isento"
    assert _resolve_tax_field_value("N/A", None) == "N/A"
    assert _resolve_tax_field_value("0/3", None) == "Pago"
    assert _resolve_tax_field_value("2025 em aberto", None) == "Pago"
    assert _resolve_tax_field_value("Pago", "0/3") == "0/3"


def test_interpretar_parcelas_follows_portal_rules_for_open_and_installments():
    assert interpretar_parcelas("0,1") == "Em Aberto"
    assert interpretar_parcelas("2, 3") == "1/3"
    assert interpretar_parcelas("0a3") == "0/3"


def test_apply_tax_portal_result_dry_run_does_not_persist_company_taxes(client):
    _, org_id = _auth_headers_org(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="11111111000111", razao_social="Dry Run SA", municipio="ANÁPOLIS")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_funcionamento="*",
            taxa_publicidade="isento",
            status_taxas="regular",
            raw={"legacy": "ok"},
        )
        db.add(tax)
        db.commit()

        result = apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-dry",
            portal_statuses={"TAXA FUNCIONAMENTO": "2025 em aberto"},
            raw_taxes=[{"nome": "Taxa de Fiscalização de Funcionamento", "resultado": "2025 em aberto"}],
            persist=False,
        )
        db.commit()
        db.refresh(tax)

        assert result["has_debits"] is True
        assert result["marked_paid"] is False
        assert tax.taxa_funcionamento == "*"
        assert tax.taxa_publicidade == "isento"
        assert tax.status_taxas == "regular"
        assert tax.raw == {"legacy": "ok"}
    finally:
        db.close()


def test_apply_tax_portal_result_real_mode_persists_fields_raw_and_status(client):
    _, org_id = _auth_headers_org(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="22222222000122", razao_social="Persist SA", municipio="ANÁPOLIS")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_funcionamento="*",
            taxa_publicidade="isento",
            taxa_vig_sanitaria="isento",
            iss="isento",
            taxa_localiz_instalacao="isento",
            taxa_ocup_area_publica="isento",
            taxa_bombeiros="isento",
            tpi="isento",
            status_taxas="regular",
            raw={"legacy": "ok"},
        )
        db.add(tax)
        db.commit()

        result = apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-real",
            portal_statuses={
                "TAXA FUNCIONAMENTO": "2025 em aberto",
                "ISS": "0/3",
            },
            raw_taxes=[{"nome": "ISS", "resultado": "0/3"}],
            persist=True,
        )
        db.commit()
        db.refresh(tax)

        assert result["has_debits"] is True
        assert result["marked_paid"] is False
        assert tax.taxa_funcionamento == "2025 em aberto"
        assert tax.iss == "0/3"
        assert tax.taxa_publicidade == "isento"
        assert tax.status_taxas == "irregular"
        assert tax.raw is not None
        assert tax.raw["legacy"] == "ok"
        evidence = tax.raw.get("tax_portal_sync") or {}
        assert evidence.get("run_id") == "run-real"
        assert evidence.get("has_debits") is True
        assert isinstance(evidence.get("taxas_brutas"), list)
        assert isinstance(evidence.get("taxas_formatadas"), dict)
    finally:
        db.close()


def test_apply_tax_portal_result_preserves_star_and_keeps_isento_when_no_debits(client):
    _, org_id = _auth_headers_org(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="33333333000133", razao_social="Sem Debitos SA", municipio="ANÁPOLIS")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_funcionamento="*",
            taxa_publicidade="isento",
            status_taxas="irregular",
            raw={},
        )
        db.add(tax)
        db.commit()

        result = apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-no-debits",
            portal_statuses={},
            raw_taxes=[],
            persist=True,
        )
        db.commit()
        db.refresh(tax)

        assert result["has_debits"] is False
        assert result["marked_paid"] is False
        assert tax.taxa_funcionamento == "*"
        assert tax.taxa_publicidade == "isento"
        assert tax.status_taxas == "regular"
    finally:
        db.close()


def test_apply_tax_portal_result_keeps_isento_and_na_when_no_debits(client):
    _, org_id = _auth_headers_org(client)

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="66666666000166", razao_social="Nao Pagavel SA", municipio="ANÁPOLIS")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_publicidade="isento",
            iss="N/A",
            status_taxas="regular",
            raw={},
        )
        db.add(tax)
        db.commit()

        result = apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-non-payable",
            portal_statuses={},
            raw_taxes=[],
            persist=True,
        )
        db.commit()
        db.refresh(tax)

        assert result["has_debits"] is False
        assert result["marked_paid"] is False
        assert tax.taxa_publicidade == "isento"
        assert tax.iss == "N/A"
    finally:
        db.close()


def test_apply_tax_portal_result_updates_anos_em_aberto_by_current_portal_years(client):
    _, org_id = _auth_headers_org(client)
    current_year = datetime.now().year
    previous_year = current_year - 1

    db = SessionLocal()
    try:
        company = Company(org_id=org_id, cnpj="77777777000177", razao_social="Anos Em Aberto SA", municipio="ANÁPOLIS")
        db.add(company)
        db.flush()
        tax = CompanyTax(
            org_id=org_id,
            company_id=company.id,
            taxa_funcionamento=f"{previous_year} até {current_year} em aberto",
            status_taxas="irregular",
            raw={},
        )
        db.add(tax)
        db.commit()

        # Caso 1: portal ainda mostra ano anterior + ano corrente -> manter só ano anterior no raw
        apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-years-1",
            portal_statuses={"TAXA FUNCIONAMENTO": f"{previous_year} até {current_year} em aberto"},
            raw_taxes=[
                {"nome": "Taxa de Fiscalização de Funcionamento", "exercicio": str(previous_year), "resultado": f"{previous_year} em aberto"},
                {"nome": "Taxa de Fiscalização de Funcionamento", "exercicio": str(current_year), "resultado": "Em Aberto"},
            ],
            persist=True,
        )
        db.commit()
        db.refresh(tax)
        years_map_1 = (tax.raw or {}).get("anos_em_aberto_por_campo") or {}
        assert years_map_1.get("taxa_funcionamento") == [previous_year]

        # Caso 2: portal agora mostra só ano corrente -> limpar anos_em_aberto e exibir Em Aberto
        apply_tax_portal_result_to_company_tax(
            db=db,
            org_id=org_id,
            company_id=company.id,
            run_id="run-years-2",
            portal_statuses={"TAXA FUNCIONAMENTO": "Em Aberto"},
            raw_taxes=[
                {"nome": "Taxa de Fiscalização de Funcionamento", "exercicio": str(current_year), "resultado": "Em Aberto"},
            ],
            persist=True,
        )
        db.commit()
        db.refresh(tax)
        years_map_2 = (tax.raw or {}).get("anos_em_aberto_por_campo") or {}
        assert years_map_2.get("taxa_funcionamento") is None
        assert tax.taxa_funcionamento == "Em Aberto"
    finally:
        db.close()


def test_merge_summary_tracks_field_counters_debits_marked_paid_and_samples(client):
    db = SessionLocal()
    try:
        org = db.query(Org).first()
        user = db.query(User).filter(User.email == "admin@example.com").first()
        assert org is not None
        assert user is not None

        c1 = Company(org_id=org.id, cnpj="44444444000144", razao_social="Com Debito", municipio="ANÁPOLIS")
        c2 = Company(org_id=org.id, cnpj="55555555000155", razao_social="Pago", municipio="ANÁPOLIS")
        db.add(c1)
        db.add(c2)
        run = TaxPortalSyncRun(
            org_id=org.id,
            started_by_user_id=user.id,
            status="running",
            dry_run=False,
            municipio="ANÁPOLIS",
            summary={"filtered_out_count": 7},
        )
        db.add(run)
        db.commit()

        _merge_summary(
            run,
            c1,
            changes=[{"field": "taxa_publicidade", "before": "isento", "after": "Pago"}],
            has_debits=True,
            marked_paid=False,
        )
        _merge_summary(
            run,
            c2,
            changes=[{"field": "iss", "before": "isento", "after": "Pago"}],
            has_debits=False,
            marked_paid=True,
        )
        db.commit()
        db.refresh(run)

        summary = run.summary or {}
        assert summary.get("filtered_out_count") == 7
        assert summary.get("companies_with_debits") == 1
        assert summary.get("companies_marked_paid") == 1
        assert summary.get("field_counters", {}).get("taxa_publicidade") == 1
        assert summary.get("field_counters", {}).get("iss") == 1
        samples = summary.get("sample_results") or []
        assert len(samples) == 2
        assert samples[0]["has_debits"] is True
        assert samples[1]["marked_paid"] is True
    finally:
        db.close()
