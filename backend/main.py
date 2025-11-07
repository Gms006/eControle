from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


def _log_security_context() -> None:
    secret_fp = settings.jwt_secret_fingerprint
    logger.info("JWT_ALG=%s JWT_SECRET_FP=%s", settings.jwt_alg, secret_fp)


_log_security_context()

app = FastAPI(title="eControle API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")
