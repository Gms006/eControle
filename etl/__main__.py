"""Module entry-point for ``python -m etl`` convenience wrapper."""
from __future__ import annotations

from backend.etl.cli import app

if __name__ == "__main__":
    app()
