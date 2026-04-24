from pathlib import Path

import app.worker.watchers as watcher_module
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.models.licence_file_event import LicenceFileEvent
from app.models.org import Org
from app.worker.watchers import LICENCES_SUBDIR, run_scan_once


def test_watcher_updates_projection_and_is_idempotent(client, tmp_path, monkeypatch):
    db = SessionLocal()
    try:
        monkeypatch.setattr(watcher_module, "SessionLocal", lambda: db)
        monkeypatch.setattr(db, "close", lambda: None)
        org = db.query(Org).first()
        company = Company(
            org_id=org.id,
            cnpj="42345678000110",
            razao_social="Empresa Watcher",
            fs_dirname="Empresa Watcher",
            municipio="Goiania",
        )
        db.add(company)
        db.flush()
        db.add(CompanyLicence(org_id=org.id, company_id=company.id, municipio="Goiania", raw={}))
        db.commit()

        base = Path(tmp_path) / "Empresa Watcher" / LICENCES_SUBDIR
        base.mkdir(parents=True, exist_ok=True)
        file_path = base / "ALVARA_BOMBEIROS - Val 25.12.2026.pdf"
        file_path.write_bytes(b"conteudo-watcher")

        stats_first = run_scan_once(str(tmp_path))
        last_error = (
            db.query(LicenceFileEvent)
            .filter(LicenceFileEvent.org_id == org.id, LicenceFileEvent.company_id == company.id)
            .order_by(LicenceFileEvent.created_at.desc())
            .first()
        )
        assert stats_first["processed"] == 1, {"stats": stats_first, "error": getattr(last_error, "error", None)}

        db.expire_all()
        refreshed = (
            db.query(CompanyLicence)
            .filter(CompanyLicence.org_id == org.id, CompanyLicence.company_id == company.id)
            .first()
        )
        assert refreshed is not None
        assert refreshed.cercon == "possui"
        assert refreshed.cercon_valid_until.isoformat() == "2026-12-25"
        assert refreshed.raw["validade_cercon"] == "2026-12-25"

        events_count_first = (
            db.query(LicenceFileEvent)
            .filter(LicenceFileEvent.org_id == org.id, LicenceFileEvent.company_id == company.id)
            .count()
        )
        assert events_count_first == 1

        stats_second = run_scan_once(str(tmp_path))
        assert stats_second["processed"] == 0
        assert stats_second["skipped"] >= 1

        events_count_second = (
            db.query(LicenceFileEvent)
            .filter(LicenceFileEvent.org_id == org.id, LicenceFileEvent.company_id == company.id)
            .count()
        )
        assert events_count_second == 1
    finally:
        db.close()


def test_watcher_prefers_definitive_then_larger_expiry(client, tmp_path, monkeypatch):
    db = SessionLocal()
    try:
        monkeypatch.setattr(watcher_module, "SessionLocal", lambda: db)
        monkeypatch.setattr(db, "close", lambda: None)
        org = db.query(Org).first()
        company = Company(
            org_id=org.id,
            cnpj="62345678000110",
            razao_social="Empresa Prioridade",
            fs_dirname="Empresa Prioridade",
            municipio="Goiania",
        )
        db.add(company)
        db.flush()
        db.add(CompanyLicence(org_id=org.id, company_id=company.id, municipio="Goiania", raw={}))
        db.commit()

        base = Path(tmp_path) / "Empresa Prioridade" / LICENCES_SUBDIR
        base.mkdir(parents=True, exist_ok=True)
        (base / "ALVARA_FUNCIONAMENTO_CONDICIONADO - Val 20.12.2026.pdf").write_bytes(b"condicionado")
        (base / "ALVARA_FUNCIONAMENTO_PROVISORIO - Val 20.12.2027.pdf").write_bytes(b"provisorio")
        (base / "ALVARA_FUNCIONAMENTO - Definitivo.pdf").write_bytes(b"definitivo")
        (base / "Alvará Vig Sanitária - Val 31.12.2026.pdf").write_bytes(b"sanitaria-val")
        (base / "Dispensa Sanitária - Definitivo.pdf").write_bytes(b"sanitaria-def")

        stats = run_scan_once(str(tmp_path))
        last_error = (
            db.query(LicenceFileEvent)
            .filter(LicenceFileEvent.org_id == org.id, LicenceFileEvent.company_id == company.id)
            .order_by(LicenceFileEvent.created_at.desc())
            .first()
        )
        assert stats["processed"] == 5, {"stats": stats, "error": getattr(last_error, "error", None)}

        db.expire_all()
        refreshed = (
            db.query(CompanyLicence)
            .filter(CompanyLicence.org_id == org.id, CompanyLicence.company_id == company.id)
            .first()
        )
        assert refreshed is not None
        assert refreshed.alvara_funcionamento == "definitivo"
        assert refreshed.alvara_funcionamento_kind == "DEFINITIVO"
        assert refreshed.raw.get("source_kind_alvara_funcionamento") == "definitivo"
        assert refreshed.raw.get("alvara_funcionamento_kind") == "DEFINITIVO"
        assert refreshed.alvara_funcionamento_valid_until is None
        assert refreshed.raw.get("validade_alvara_funcionamento") is None
        assert refreshed.alvara_vig_sanitaria == "definitivo"
        assert refreshed.raw.get("source_kind_alvara_vig_sanitaria") == "definitivo"
        assert refreshed.alvara_vig_sanitaria_valid_until is None
        assert refreshed.raw.get("validade_alvara_vig_sanitaria") is None
        assert refreshed.raw.get("source_document_kind_alvara_vig_sanitaria") == "DISPENSA_SANITARIA"
    finally:
        db.close()


def test_watcher_uses_structured_subdir_and_skips_when_missing(client, tmp_path, monkeypatch):
    db = SessionLocal()
    try:
        monkeypatch.setattr(watcher_module, "SessionLocal", lambda: db)
        monkeypatch.setattr(db, "close", lambda: None)
        org = db.query(Org).first()

        matriz = Company(
            org_id=org.id,
            cnpj="72345678000110",
            razao_social="Empresa Layout Matriz",
            fs_dirname="Empresa Layout",
            municipio="Anápolis",
        )
        filial = Company(
            org_id=org.id,
            cnpj="72345678000210",
            razao_social="Empresa Layout Filial",
            fs_dirname="Empresa Layout",
            municipio="Goiânia",
        )
        db.add(matriz)
        db.add(filial)
        db.flush()
        db.add(CompanyLicence(org_id=org.id, company_id=matriz.id, municipio="Anápolis", raw={}))
        db.add(CompanyLicence(org_id=org.id, company_id=filial.id, municipio="Goiânia", raw={}))
        db.commit()

        base = Path(tmp_path) / "Empresa Layout" / LICENCES_SUBDIR
        (base / "Anápolis - Matriz").mkdir(parents=True, exist_ok=True)
        (base / "Anápolis - Matriz" / "Alvará Bombeiros - Val 10.01.2028.pdf").write_bytes(b"matriz")

        stats = run_scan_once(str(tmp_path))
        assert stats["processed"] == 1

        db.expire_all()
        matriz_row = (
            db.query(CompanyLicence)
            .filter(CompanyLicence.org_id == org.id, CompanyLicence.company_id == matriz.id)
            .first()
        )
        filial_row = (
            db.query(CompanyLicence)
            .filter(CompanyLicence.org_id == org.id, CompanyLicence.company_id == filial.id)
            .first()
        )
        assert matriz_row is not None and matriz_row.cercon == "possui"
        assert filial_row is not None and filial_row.cercon in (None, "")
    finally:
        db.close()
