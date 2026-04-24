from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.models.notification_event import NotificationEvent
from app.models.org import Org
from app.services.business_days import add_business_days
from app.services.notification_operational_scan import run_notification_operational_scan


def _create_company(db, org_id: str, suffix: str) -> Company:
    suffix2 = str(suffix).zfill(2)[-2:]
    company = Company(
        org_id=org_id,
        cnpj=f"{suffix2}.111.111/0001-{suffix2}",
        razao_social=f"Empresa {suffix}",
    )
    db.add(company)
    db.flush()
    return company


def test_notification_rules_generate_events_and_dedupe(client):
    base_date = datetime(2026, 4, 6, 12, 0, tzinfo=timezone.utc).date()  # Monday

    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        other_org = Org(name="Org Rule Isolamento", slug=f"org-rule-{uuid.uuid4().hex[:6]}")
        db.add(other_org)
        db.commit()
        db.refresh(other_org)

        company = _create_company(db, org.id, "11")
        other_company = _create_company(db, other_org.id, "22")

        licence = CompanyLicence(
            org_id=org.id,
            company_id=company.id,
            cercon_valid_until=add_business_days(base_date, 5),
            alvara_funcionamento_valid_until=base_date + timedelta(days=30),
            alvara_vig_sanitaria_valid_until=base_date + timedelta(days=30),
            licenca_ambiental_valid_until=add_business_days(base_date, 30),
        )
        db.add(licence)

        other_licence = CompanyLicence(
            org_id=other_org.id,
            company_id=other_company.id,
            cercon_valid_until=add_business_days(base_date, 5),
        )
        db.add(other_licence)

        process_7 = CompanyProcess(
            org_id=org.id,
            company_id=company.id,
            process_type="ALVARA",
            protocolo=f"PROC-7-{uuid.uuid4().hex[:6]}",
            updated_at=datetime.combine(add_business_days(base_date, -8), datetime.min.time(), tzinfo=timezone.utc),
        )
        process_15 = CompanyProcess(
            org_id=org.id,
            company_id=company.id,
            process_type="AMBIENTAL",
            protocolo=f"PROC-15-{uuid.uuid4().hex[:6]}",
            updated_at=datetime.combine(add_business_days(base_date, -16), datetime.min.time(), tzinfo=timezone.utc),
        )
        process_terminal = CompanyProcess(
            org_id=org.id,
            company_id=company.id,
            process_type="ALVARA",
            protocolo=f"PROC-END-{uuid.uuid4().hex[:6]}",
            situacao="Concluído",
            updated_at=datetime.combine(add_business_days(base_date, -20), datetime.min.time(), tzinfo=timezone.utc),
        )
        db.add(process_7)
        db.add(process_15)
        db.add(process_terminal)
        db.commit()

        summary = run_notification_operational_scan(db, org_id=org.id, base_date=base_date)
        assert summary["emitted_count"] >= 6
        events = db.query(NotificationEvent).filter(NotificationEvent.org_id == org.id).all()
        dedupe_keys = {item.dedupe_key for item in events}
        assert any("LIC_BOMBEIROS_BD5" in key for key in dedupe_keys)
        assert any("LIC_ALVARA_D30" in key for key in dedupe_keys)
        assert any("LIC_SANITARIO_D30" in key for key in dedupe_keys)
        assert any("LIC_AMBIENTAL_BD30" in key for key in dedupe_keys)
        assert any("PROC_STALE_BD7" in key for key in dedupe_keys)
        assert any("PROC_STALE_BD15" in key for key in dedupe_keys)
        assert all(process_terminal.id not in key for key in dedupe_keys)

        first_count = len(events)
        summary_again = run_notification_operational_scan(db, org_id=org.id, base_date=base_date)
        second_count = db.query(NotificationEvent).filter(NotificationEvent.org_id == org.id).count()
        assert second_count == first_count
        assert summary_again["emitted_count"] == 0
        assert summary_again["deduped_count"] >= 1

        other_org_count = db.query(NotificationEvent).filter(NotificationEvent.org_id == other_org.id).count()
        assert other_org_count == 0
    finally:
        db.close()


def test_notification_rules_ignore_periodic_renewal_for_valid_definitive_alvara(client):
    base_date = datetime(2026, 4, 6, 12, 0, tzinfo=timezone.utc).date()

    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        company = _create_company(db, org.id, "31")
        db.add(
            CompanyLicence(
                org_id=org.id,
                company_id=company.id,
                alvara_funcionamento="definitivo",
                alvara_funcionamento_kind="DEFINITIVO",
                alvara_funcionamento_valid_until=base_date + timedelta(days=10),
            )
        )
        db.commit()

        summary = run_notification_operational_scan(db, org_id=org.id, base_date=base_date)
        assert summary["emitted_count"] == 0
        events = db.query(NotificationEvent).filter(NotificationEvent.org_id == org.id).all()
        assert events == []
    finally:
        db.close()


def test_notification_rules_emit_specific_alert_for_invalidated_definitive_alvara(client):
    base_date = datetime(2026, 4, 6, 12, 0, tzinfo=timezone.utc).date()

    db = SessionLocal()
    try:
        org = db.query(Org).first()
        assert org is not None
        company = _create_company(db, org.id, "32")
        licence = CompanyLicence(
            org_id=org.id,
            company_id=company.id,
            alvara_funcionamento="definitivo",
            alvara_funcionamento_kind="DEFINITIVO",
            alvara_funcionamento_valid_until=base_date + timedelta(days=10),
        )
        db.add(licence)
        db.flush()
        db.add(
            CompanyProcess(
                org_id=org.id,
                company_id=company.id,
                process_type="DIVERSOS",
                protocolo="ALT-032",
                orgao="Prefeitura",
                operacao="Alteração",
                obs="Alteração de endereço e nome fantasia.",
                updated_at=datetime.now(timezone.utc) + timedelta(minutes=1),
            )
        )
        db.commit()

        summary = run_notification_operational_scan(db, org_id=org.id, base_date=base_date)
        assert summary["emitted_count"] == 1
        event = db.query(NotificationEvent).filter(NotificationEvent.org_id == org.id).first()
        assert event is not None
        assert event.metadata_json["rule_code"] == "LIC_DEFINITIVO_INVALIDADO"
        assert event.metadata_json["requires_new_licence_request"] is True
        assert "novo alvará" in event.message.lower()
        assert "LIC_ALVARA_D30" not in event.dedupe_key
    finally:
        db.close()
