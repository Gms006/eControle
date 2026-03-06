import inspect
import logging
import secrets
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.org import Org
from app.schemas.webhook_certhub import CertHubWebhookPayload, WebhookMode
from app.services.certificados_mirror import (
    delete_certificates_by_cert_ids,
    ingest_certificates_from_payload,
    reconcile_full,
)

router = APIRouter(prefix="/integracoes/certhub", tags=["integracoes"])
logger = logging.getLogger("econtrole.webhook_certhub")


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return token.strip()


async def _resolve_org_by_slug(db: Session, org_slug: str) -> Org | None:
    stmt = select(Org).where(Org.slug == org_slug)
    result = await _maybe_await(db.execute(stmt))
    return result.scalar_one_or_none()


@router.post("/webhook")
async def webhook_certhub(
    payload: CertHubWebhookPayload,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    expected_token = str(getattr(settings, "CERTHUB_WEBHOOK_TOKEN", "") or "").strip()
    received_token = _extract_bearer_token(authorization)

    if not expected_token or not received_token or not secrets.compare_digest(received_token, expected_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing webhook token")

    org = await _resolve_org_by_slug(db, payload.org_slug)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization not found for slug '{payload.org_slug}'",
        )

    logger.info(
        "CertHub webhook received",
        extra={
            "mode": payload.mode.value,
            "org_slug": payload.org_slug,
            "certificates_count": len(payload.certificates or []),
            "deleted_cert_ids_count": len(payload.deleted_cert_ids or []),
        },
    )

    if payload.mode == WebhookMode.upsert:
        result = await ingest_certificates_from_payload(db, org, payload.certificates or [])
    elif payload.mode == WebhookMode.delete:
        result = await delete_certificates_by_cert_ids(db, org, payload.deleted_cert_ids or [])
    else:  # payload.mode == WebhookMode.full
        result = await reconcile_full(db, org, payload.certificates or [])

    return {"status": "ok", "mode": payload.mode.value, **result}
