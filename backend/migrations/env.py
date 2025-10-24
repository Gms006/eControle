"""Alembic environment configuration."""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

MIGRATIONS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = MIGRATIONS_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Carrega o .env que está em backend/.env
DOTENV_PATH = BACKEND_DIR / ".env"
load_dotenv(DOTENV_PATH)

config = context.config

# Lê a env var e injeta no alembic.ini em runtime
db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise RuntimeError("DATABASE_URL não encontrada no backend/.env")
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from backend.db.models_sql import Base  # noqa: E402

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
