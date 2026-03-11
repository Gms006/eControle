from __future__ import annotations

import importlib.util
from pathlib import Path

import sqlalchemy as sa


def _load_migration_module():
    base_dir = Path(__file__).resolve().parents[1]
    migration_path = base_dir / "alembic" / "versions" / "20260311_0018_licences_valid_until_and_scan_runs.py"
    spec = importlib.util.spec_from_file_location("migration_20260311_0018", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration_module()


def test_migration_backfill_normalizes_legacy_status_and_date():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                """
                CREATE TABLE company_licences (
                    id TEXT PRIMARY KEY,
                    raw JSON NULL,
                    cercon TEXT NULL,
                    alvara_vig_sanitaria TEXT NULL,
                    alvara_funcionamento TEXT NULL,
                    certidao_uso_solo TEXT NULL,
                    licenca_ambiental TEXT NULL,
                    cercon_valid_until DATE NULL,
                    alvara_vig_sanitaria_valid_until DATE NULL,
                    alvara_funcionamento_valid_until DATE NULL,
                    certidao_uso_solo_valid_until DATE NULL,
                    licenca_ambiental_valid_until DATE NULL
                )
                """
            )
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO company_licences (
                    id, raw, cercon, alvara_vig_sanitaria
                ) VALUES (
                    :id, :raw, :cercon, :alvara_vig_sanitaria
                )
                """
            ),
            {
                "id": "legacy-1",
                "raw": '{"validade_cercon":"2028-02-10"}',
                "cercon": "possui_val_01_01_2027",
                "alvara_vig_sanitaria": "vencido_val_31_12_2024",
            },
        )

        migration.backfill_company_licences(connection)

        row = connection.execute(
            sa.text(
                """
                SELECT cercon, cercon_valid_until, alvara_vig_sanitaria, alvara_vig_sanitaria_valid_until
                FROM company_licences
                WHERE id = :id
                """
            ),
            {"id": "legacy-1"},
        ).first()
        assert row is not None
        assert row[0] == "possui"
        assert str(row[1]) == "2028-02-10"
        assert row[2] == "vencido"
        assert str(row[3]) == "2024-12-31"
