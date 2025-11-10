"""Utility script to mint development JWTs aligned with API settings."""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from jose import jwt

# Adiciona o diretório backend ao path para importar app
backend_dir = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_dir))

# Carrega o .env ANTES de importar settings
from dotenv import load_dotenv
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Agora sim, importa settings
from app.core.config import settings
from app.deps.auth import Role


def generate_dev_jwt(
    *,
    sub: str,
    org_id: str,
    email: Optional[str] = None,
    role: Role = Role.VIEWER,
    expires_in_hours: int = 2,
) -> str:
    """Generate a signed JWT compatible with the application settings."""

    now = datetime.now(timezone.utc)
    payload = {
        "sub": int(sub),  # ← MUDEI AQUI: converter para int
        "org_id": str(org_id),
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=expires_in_hours)).timestamp()),
    }
    if email:
        payload["email"] = email

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mint a development JWT for the API")
    parser.add_argument("--sub", default="1", help="User identifier (sub claim)")
    parser.add_argument("--org-id", required=True, help="Organization UUID for org_id claim")
    parser.add_argument("--email", default=None, help="Optional email claim")
    parser.add_argument(
        "--role",
        default=Role.VIEWER.value,
        choices=[role.value for role in Role],
        help="Role claim for RBAC checks",
    )
    parser.add_argument(
        "--expires-in",
        type=int,
        default=2,
        help="Token expiration window in hours",
    )

    args = parser.parse_args()
    token = generate_dev_jwt(
        sub=args.sub,
        org_id=args.org_id,
        email=args.email,
        role=Role(args.role),
        expires_in_hours=args.expires_in,
    )

    print(f"ALG={settings.jwt_alg} SECRET_FP={settings.jwt_secret_fingerprint}")
    print(token)


if __name__ == "__main__":
    main()
