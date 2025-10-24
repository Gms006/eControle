"""Contracts derived from ``config.yaml`` for the ETL."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Mapping, MutableMapping

import yaml
from pydantic import BaseModel, Field, PrivateAttr, field_validator

from .normalizers import strip_accents


class ConfigContract(BaseModel):
    sheet_names: Dict[str, str]
    table_names: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    enums: Dict[str, List[str]]
    column_aliases: Dict[str, Dict[str, List[str]]]

    _alias_cache: MutableMapping[str, Dict[str, str]] = PrivateAttr(default_factory=dict)

    @field_validator("sheet_names", mode="before")
    @classmethod
    def _ensure_sheet_names(cls, value: Mapping[str, str]) -> Mapping[str, str]:
        if not value:
            raise ValueError("sheet_names must not be empty")
        return value

    def alias_map(self, section: str) -> Dict[str, str]:
        if section not in self.column_aliases:
            raise KeyError(f"Section '{section}' not present in column_aliases")
        if section not in self._alias_cache:
            alias_section: Dict[str, str] = {}
            for canonical, aliases in self.column_aliases[section].items():
                all_aliases = [canonical, *aliases]
                for alias in all_aliases:
                    if alias is None:
                        continue
                    key = self._normalize_alias(alias)
                    alias_section[key] = canonical
            self._alias_cache[section] = alias_section
        return self._alias_cache[section]

    @staticmethod
    def _normalize_alias(alias: str) -> str:
        normalized = strip_accents(str(alias)).casefold()
        return normalized.replace(" ", "").replace("_", "")

    def match_alias(self, section: str, header: str | None) -> str | None:
        if header is None:
            return None
        key = self._normalize_alias(header)
        return self.alias_map(section).get(key)

    def require_enum(self, enum_key: str) -> List[str]:
        values = self.enums.get(enum_key)
        if not values:
            raise KeyError(f"Enum '{enum_key}' not found in config.yaml")
        return values


def load_contract(path: str | Path | None = None) -> ConfigContract:
    config_path = Path(path) if path else _default_config_path()
    if not config_path.exists():
        raise FileNotFoundError(f"config.yaml não encontrado em {config_path}")
    with config_path.open("r", encoding="utf-8") as handler:
        data = yaml.safe_load(handler) or {}
    return ConfigContract(**data)


def _default_config_path() -> Path:
    base_dir = Path(__file__).resolve().parents[1]
    env_path = os.getenv("CONFIG_PATH")
    if env_path:
        path = Path(env_path)
        if not path.is_absolute():
            path = (base_dir / env_path).resolve()
        return path
    return (base_dir / "config.yaml").resolve()
