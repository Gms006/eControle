from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import jwt
import pytest
from fastapi.testclient import TestClient

# Configuração mínima para carregar o app
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_ALG", "HS256")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

BACKEND_PATH = PROJECT_ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from app.deps.auth import db_with_org  # noqa: E402
from backend.main import app  # noqa: E402


class _MappingResult:
    def __init__(self, data: List[Dict[str, Any]]) -> None:
        self._data = data

    def all(self) -> List[Dict[str, Any]]:
        return self._data

    def first(self) -> Dict[str, Any] | None:
        return self._data[0] if self._data else None


class _CountResult:
    def __init__(self, value: int) -> None:
        self._value = value

    def scalar_one(self) -> int:
        return self._value


class _Result:
    def __init__(self, data: List[Dict[str, Any]]) -> None:
        self._mapping = _MappingResult(data)

    def mappings(self) -> _MappingResult:
        return self._mapping


class FakeSession:
    def __init__(self) -> None:
        self._empresas = [
            {
                "empresa_id": 1,
                "org_id": "00000000-0000-0000-0000-000000000001",
                "empresa": "Alpha",
                "cnpj": "12345678000190",
                "municipio": "Anápolis",
                "porte": "ME",
                "categoria": "Serviços",
                "status_empresas": "Ativa",
                "situacao": "Em dia",
                "debito": "Não",
                "certificado": "Sim",
                "total_licencas": 2,
                "total_taxas": 3,
                "processos_ativos": 1,
                "updated_at": None,
            }
        ]

    def execute(self, statement, params=None):  # noqa: ANN001
        sql = str(statement)
        params = params or {}
        if "COUNT(*)" in sql:
            return _CountResult(len(self._filter_empresas(params)))
        if "FROM v_empresas" in sql:
            data = self._filter_empresas(params)
            return _Result(data)
        raise AssertionError(f"Consulta não suportada nos testes: {sql}")

    def _filter_empresas(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        data = self._empresas
        if "municipio" in params:
            data = [item for item in data if item["municipio"] == params["municipio"]]
        if "porte" in params:
            data = [item for item in data if item["porte"] == params["porte"]]
        if "categoria" in params:
            data = [item for item in data if item["categoria"] == params["categoria"]]
        if "q" in params:
            token = params["q"].strip("%").lower()
            data = [
                item
                for item in data
                if token in item["empresa"].lower() or token in item["cnpj"].lower()
            ]
        return data

    def close(self) -> None:
        pass


@pytest.fixture()
def client() -> TestClient:
    app.dependency_overrides[db_with_org] = lambda: FakeSession()
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token() -> str:
    payload = {
        "sub": "1",
        "org_id": "00000000-0000-0000-0000-000000000001",
        "email": "admin@example.com",
        "role": "ADMIN",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=os.environ["JWT_ALG"])


def test_healthz(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_empresas_listagem(client: TestClient, admin_token: str) -> None:
    response = client.get("/api/v1/empresas", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "page", "size"}
    assert body["page"] == 1
    assert isinstance(body["items"], list)
    assert body["total"] == len(body["items"])
    if body["items"]:
        assert "empresa_id" in body["items"][0]
