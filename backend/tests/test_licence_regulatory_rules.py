from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.company_licence import CompanyLicence
from app.models.company_process import CompanyProcess
from app.services.licence_regulatory_rules import evaluate_definitive_alvara_regulatory_status


def test_definitive_alvara_is_invalidated_only_with_clear_prefeitura_change_context():
    licence = CompanyLicence(
        org_id="org-1",
        company_id="company-1",
        alvara_funcionamento="definitivo",
        alvara_funcionamento_kind="DEFINITIVO",
        updated_at=datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc),
    )
    process = CompanyProcess(
        id="proc-1",
        org_id="org-1",
        company_id="company-1",
        process_type="DIVERSOS",
        protocolo="ALT-001",
        orgao="Prefeitura",
        operacao="Alteração",
        obs="Alteração Razão Social, Nome Fantasia e endereço do estabelecimento.",
        updated_at=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
    )

    payload = evaluate_definitive_alvara_regulatory_status(licence=licence, processes=[process])

    assert payload["has_definitive_alvara"] is True
    assert payload["definitive_alvara_invalidated"] is True
    assert payload["invalidated_reasons"] == ["RAZAO_SOCIAL", "NOME_FANTASIA", "ENDERECO"]
    assert payload["invalidating_process_id"] == "proc-1"
    assert payload["invalidating_process_ref"] == "ALT-001"
    assert payload["requires_new_licence_request"] is True


def test_definitive_alvara_ignores_ambiguous_or_old_processes():
    licence = CompanyLicence(
        org_id="org-1",
        company_id="company-1",
        alvara_funcionamento="definitivo",
        alvara_funcionamento_kind="DEFINITIVO",
        updated_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
    )
    ambiguous = CompanyProcess(
        id="proc-amb",
        org_id="org-1",
        company_id="company-1",
        process_type="DIVERSOS",
        protocolo="ALT-AMB",
        orgao="Prefeitura",
        operacao="Alteração",
        obs="Alteração cadastral em análise.",
        updated_at=datetime(2026, 4, 21, 12, 0, tzinfo=timezone.utc),
    )
    old_process = CompanyProcess(
        id="proc-old",
        org_id="org-1",
        company_id="company-1",
        process_type="DIVERSOS",
        protocolo="ALT-OLD",
        orgao="Prefeitura",
        operacao="Alteração",
        obs="Alteração de CNAE.",
        updated_at=datetime(2026, 4, 15, 12, 0, tzinfo=timezone.utc) - timedelta(days=10),
    )

    payload = evaluate_definitive_alvara_regulatory_status(licence=licence, processes=[ambiguous, old_process])

    assert payload["has_definitive_alvara"] is True
    assert payload["definitive_alvara_invalidated"] is False
    assert payload["invalidated_reasons"] == []
    assert payload["invalidating_process_id"] is None
    assert payload["requires_new_licence_request"] is False
