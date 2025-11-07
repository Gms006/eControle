import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from fastapi.testclient import TestClient
from jose import jwt
import pytest

# Garantir que as variáveis necessárias existam antes de importar o app
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_ALG", "hs256")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
BACKEND_PATH = PROJECT_ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.core.config import settings  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.deps.auth import Role  # noqa: E402
from backend.main import app  # noqa: E402
from backend.scripts.dev.mint_jwt import generate_dev_jwt  # noqa: E402

ORG_ID = "00000000-0000-0000-0000-000000000001"


class _MappingResult:
    def __init__(self, data: List[Dict[str, Any]]) -> None:
        self._data = data

    def all(self) -> List[Dict[str, Any]]:
        return self._data


class _Result:
    def __init__(self, data: List[Dict[str, Any]]) -> None:
        self._mapping = _MappingResult(data)

    def mappings(self) -> _MappingResult:
        return self._mapping


class _CountResult:
    def __init__(self, value: int) -> None:
        self._value = value

    def scalar_one(self) -> int:
        return self._value


class FakeSession:
    def __init__(self) -> None:
        self._rows = [
            {
                "org_id": ORG_ID,
                "grupo": "empresas",
                "chave": "total_empresas",
                "valor": 5,
            },
            {
                "org_id": ORG_ID,
                "grupo": "empresas",
                "chave": "sem_certificado",
                "valor": 1,
            },
        ]
        self.current_org: str | None = None

    def execute(self, statement, params: Dict[str, Any] | None = None):  # noqa: ANN001
        sql = str(statement)
        params = params or {}
        if "SET LOCAL app.current_org" in sql:
            self.current_org = params.get("org_id")
            return None
        if "COUNT(*)" in sql:
            return _CountResult(len(self._filtered_rows(params)))
        if "FROM v_grupos_kpis" in sql:
            data = self._filtered_rows(params)
            return _Result(data)
        raise AssertionError(f"Consulta não suportada: {sql}")

    def _filtered_rows(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        data = [row for row in self._rows if row["org_id"] == self.current_org]
        if "grupo" in params:
            data = [row for row in data if row["grupo"] == params["grupo"]]
        offset = int(params.get("offset", 0))
        limit = params.get("limit")
        if limit is not None:
            limit = int(limit)
            data = data[offset : offset + limit]
        return data

    def close(self) -> None:
        pass


@pytest.fixture()
def client() -> TestClient:
    def override_get_db():
        session = FakeSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def valid_token() -> str:
    return generate_dev_jwt(
        sub="1",
        org_id=ORG_ID,
        email="viewer@example.com",
        role=Role.VIEWER,
    )


def test_grupos_kpis_authorized_returns_200(client: TestClient, valid_token: str) -> None:
    response = client.get(
        "/api/v1/grupos/kpis",
        params={"size": 1},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["size"] == 1
    assert isinstance(body["items"], list)
    assert len(body["items"]) <= 1


def test_grupos_kpis_wrong_token_returns_401(client: TestClient) -> None:
    payload = {
        "sub": "1",
        "org_id": ORG_ID,
        "email": "viewer@example.com",
        "role": Role.VIEWER.value,
    }
    bad_token = jwt.encode(payload, "wrong-secret", algorithm=settings.jwt_alg)
    response = client.get(
        "/api/v1/grupos/kpis",
        params={"size": 1},
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Token inválido"


def test_grupos_kpis_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/grupos/kpis", params={"size": 1})
    assert response.status_code == 401
    assert response.json()["detail"] == "Token inválido"
