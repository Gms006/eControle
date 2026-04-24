from __future__ import annotations

import importlib.util
from pathlib import Path

import sqlalchemy as sa


def _load_migration_module():
    base_dir = Path(__file__).resolve().parents[1]
    migration_path = base_dir / "alembic" / "versions" / "20260423_0030_add_regulatory_domain_fields.py"
    spec = importlib.util.spec_from_file_location("migration_20260423_0030", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration_module()


def test_regulatory_migration_backfill_is_conservative():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                """
                CREATE TABLE company_licences (
                    id TEXT PRIMARY KEY,
                    raw JSON NULL,
                    alvara_funcionamento_kind TEXT NULL
                )
                """
            )
        )
        connection.execute(
            sa.text(
                """
                CREATE TABLE company_profiles (
                    id TEXT PRIMARY KEY,
                    raw JSON NULL,
                    sanitary_complexity TEXT NULL,
                    address_usage_type TEXT NULL,
                    address_location_type TEXT NULL
                )
                """
            )
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO company_licences (id, raw) VALUES
                    ('lic-1', '{"source_document_kind_alvara_funcionamento":"ALVARA_FUNCIONAMENTO_PROVISORIO"}'),
                    ('lic-2', '{"source_kind_alvara_funcionamento":"definitivo"}'),
                    ('lic-3', '{}')
                """
            )
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO company_profiles (id, raw) VALUES
                    ('profile-1', '{"endereco_fiscal": true}'),
                    ('profile-2', '{}')
                """
            )
        )

        migration.backfill_company_licences(connection)
        migration.backfill_company_profiles(connection)

        licence_rows = connection.execute(
            sa.text(
                """
                SELECT id, alvara_funcionamento_kind
                FROM company_licences
                ORDER BY id
                """
            )
        ).all()
        assert licence_rows == [
            ("lic-1", "PROVISORIO"),
            ("lic-2", "DEFINITIVO"),
            ("lic-3", "PENDENTE_REVISAO"),
        ]

        profile_rows = connection.execute(
            sa.text(
                """
                SELECT id, sanitary_complexity, address_usage_type, address_location_type
                FROM company_profiles
                ORDER BY id
                """
            )
        ).all()
        assert profile_rows == [
            ("profile-1", "PENDENTE_REVISAO", "FISCAL", "PENDENTE_REVISAO"),
            ("profile-2", "PENDENTE_REVISAO", "PENDENTE_REVISAO", "PENDENTE_REVISAO"),
        ]
