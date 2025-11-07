from __future__ import annotations

import json
import os
import hashlib
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

import yaml
from pydantic import BaseModel, Field, field_validator


class Settings(BaseModel):
    """Application configuration loaded from environment variables."""

    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_alg: str = Field(default="HS256", alias="JWT_ALG")
    cors_origins: List[str] = Field(default_factory=list, alias="CORS_ORIGINS")
    config_path: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2] / "config.yaml", alias="CONFIG_PATH")

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

    @field_validator("jwt_secret", mode="before")
    @classmethod
    def _normalize_secret(cls, value: Any) -> str:
        if value is None:
            return value
        secret = str(value).strip()
        if (secret.startswith("\"") and secret.endswith("\"")) or (
            secret.startswith("'") and secret.endswith("'")
        ):
            secret = secret[1:-1]
        return secret.strip()

    @field_validator("jwt_alg", mode="before")
    @classmethod
    def _normalize_alg(cls, value: Any) -> str:
        if value is None:
            return "HS256"
        return str(value).strip().upper()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except json.JSONDecodeError:
                pass
            return [part.strip() for part in raw.split(",") if part.strip()]
        raise TypeError("CORS_ORIGINS deve ser lista ou string separada por vírgula")

    @field_validator("config_path", mode="before")
    @classmethod
    def _resolve_config_path(cls, value: Any) -> Path:
        if value is None or value == "":
            return Path(__file__).resolve().parents[2] / "config.yaml"
        path = Path(value)
        if not path.is_absolute():
            path = (Path(__file__).resolve().parents[2] / value).resolve()
        return path

    @classmethod
    def from_env(cls) -> "Settings":
        data: Dict[str, Any] = {}
        missing: List[str] = []
        for field in ("DATABASE_URL", "JWT_SECRET"):
            env_value = os.getenv(field)
            if not env_value:
                missing.append(field)
            else:
                data[field] = env_value
        if missing:
            raise RuntimeError(f"Variáveis obrigatórias ausentes: {', '.join(missing)}")

        optional_fields = {
            "JWT_ALG": os.getenv("JWT_ALG", "HS256"),
            "CORS_ORIGINS": os.getenv("CORS_ORIGINS", ""),
            "CONFIG_PATH": os.getenv("CONFIG_PATH"),
        }
        data.update(optional_fields)
        return cls(**data)

    @property
    def config(self) -> Dict[str, Any]:
        return load_config(self.config_path)

    def get_enum_values(self, enum_key: str) -> List[str]:
        enums = self.config.get("enums", {})
        return list(enums.get(enum_key, []))

    @property
    def jwt_secret_fingerprint(self) -> str:
        return hashlib.sha256(self.jwt_secret.encode("utf-8")).hexdigest()[:12]


@lru_cache(maxsize=1)
def load_config(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as stream:
        return yaml.safe_load(stream) or {}


settings = Settings.from_env()
