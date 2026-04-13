from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.org import Org
from app.schemas.copilot import CopilotCategory, CopilotResponseOut
from app.services.copilot import respond_to_copilot
from app.services.copilot_provider import CopilotProviderError

router = APIRouter()

MAX_DOCUMENT_BYTES = 12 * 1024 * 1024

PROVIDER_ERROR_STATUS = {
    "GEMINI_API_KEY_MISSING": status.HTTP_503_SERVICE_UNAVAILABLE,
    "GEMINI_SDK_UNAVAILABLE": status.HTTP_503_SERVICE_UNAVAILABLE,
    "PROVIDER_AUTH_ERROR": status.HTTP_503_SERVICE_UNAVAILABLE,
    "PROVIDER_RATE_LIMIT": status.HTTP_429_TOO_MANY_REQUESTS,
    "PROVIDER_TIMEOUT": status.HTTP_504_GATEWAY_TIMEOUT,
    "PROVIDER_UNAVAILABLE": status.HTTP_503_SERVICE_UNAVAILABLE,
    "PROVIDER_FALLBACK_EXHAUSTED": status.HTTP_503_SERVICE_UNAVAILABLE,
    "PROVIDER_DISABLED": status.HTTP_503_SERVICE_UNAVAILABLE,
}


@router.post("/respond", response_model=CopilotResponseOut)
async def respond(
    category: CopilotCategory = Form(...),
    company_id: str | None = Form(default=None),
    message: str = Form(default=""),
    document: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> CopilotResponseOut:
    content: bytes | None = None
    filename: str | None = None
    content_type: str | None = None
    if document is not None:
        filename = document.filename or None
        content_type = document.content_type or None
        content = await document.read()
        await document.close()
        if len(content) > MAX_DOCUMENT_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Document too large")

    try:
        payload = respond_to_copilot(
            db,
            org_id=org.id,
            category=category,
            company_id=company_id,
            message=message,
            document_name=filename,
            document_content_type=content_type,
            document_content=content,
        )
    except ValueError as exc:
        if str(exc) == "COMPANY_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        if str(exc) == "COMPANY_REQUIRED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company is required for this category")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except CopilotProviderError as exc:
        mapped_status = PROVIDER_ERROR_STATUS.get(exc.code, status.HTTP_503_SERVICE_UNAVAILABLE)
        raise HTTPException(status_code=mapped_status, detail=exc.user_message)
    return CopilotResponseOut.model_validate(payload)
