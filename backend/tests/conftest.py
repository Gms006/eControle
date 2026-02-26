import os
import sys

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENV", "dev")
# disable seeding to avoid any bcrypt or long startup operations
os.environ.setdefault("SEED_ENABLED", "false")

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402

# monkeypatch authentication to avoid bcrypt/seeding issues during tests
from app.core import security

# replace hashing/verifying with no-op functions
security.pwd_context.hash = lambda pw: f"hashed:{pw[:72]}"
security.pwd_context.verify = lambda plain, hashed: hashed == f"hashed:{plain[:72]}"

# override get_current_user to bypass token checks and return a generic active user
from types import SimpleNamespace

async def _dummy_current_user(db=None, token=None):
    # plain object with roles attribute
    user = SimpleNamespace()
    user.roles = [SimpleNamespace(name=r) for r in ["DEV", "ADMIN", "VIEW"]]
    user.is_active = True
    user.org_id = "org1"
    return user

security.get_current_user = _dummy_current_user

from main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
