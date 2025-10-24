"""Compatibility shim exposing the backend ETL CLI as a top-level package."""
from __future__ import annotations

from backend.etl.cli import app as app
from backend.etl.cli import import_command as import_command

__all__ = ["app", "import_command"]
