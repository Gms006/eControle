from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.certificate_mirror import CertificateMirror
from app.schemas.certificate import (
    CertificateHealthResponse,
    CertificateOut,
    CertificateSyncRequest,
    CertificateSyncResponse,
)
from app.services.certhub_client import CertHubClient
from app.services.certificados_mirror import compute_situacao, upsert_mirror

router = APIRouter()


@router.get("", response_model=list[CertificateOut], dependencies=[Depends(require_roles("ADMIN", "DEV", "VIEW"))])
def list_certificados(
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    only_cnpj: bool = Query(False),
):
    query = db.query(CertificateMirror).filter(CertificateMirror.org_id == org.id)

    if only_cnpj:
        query = query.filter(func.upper(CertificateMirror.document_type) == "CNPJ")

    rows = query.order_by(CertificateMirror.not_after.asc().nullslast()).offset(offset).limit(limit).all()

    now = datetime.now(timezone.utc).date()
    out: list[CertificateOut] = []

    for row in rows:
        dias_restantes = None
        if row.not_after:
            dias_restantes = (row.not_after.date() - now).days

        cnpj = row.document_masked if (row.document_type or "").upper() == "CNPJ" else None
        titular = row.name or row.cn

        out.append(
            CertificateOut(
                id=str(row.id),
                org_id=str(row.org_id),
                company_id=str(row.company_id) if row.company_id else None,
                cert_id=row.cert_id,
                sha1_fingerprint=row.sha1_fingerprint,
                titular=titular,
                cnpj=cnpj,
                valido_de=row.not_before,
                valido_ate=row.not_after,
                dias_restantes=dias_restantes,
                situacao=compute_situacao(row.not_after),
            )
        )

    return out


@router.get(
    "/health",
    response_model=CertificateHealthResponse,
    dependencies=[Depends(require_roles("ADMIN", "DEV", "VIEW"))],
)
def certificados_health(
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    count = db.query(CertificateMirror).filter(CertificateMirror.org_id == org.id).count()
    last_ingested_at = (
        db.query(func.max(CertificateMirror.last_ingested_at))
        .filter(CertificateMirror.org_id == org.id)
        .scalar()
    )
    return CertificateHealthResponse(count=count, last_ingested_at=last_ingested_at)


@router.post("/sync", response_model=CertificateSyncResponse, dependencies=[Depends(require_roles("ADMIN", "DEV"))])
def sync_certificados(
    req: CertificateSyncRequest,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
):
    def _dump(model):
        return model.model_dump() if hasattr(model, "model_dump") else model.dict()

    # Modo payload.
    if req.certificates:
        certs = [_dump(cert) for cert in req.certificates]
        result = upsert_mirror(db, org.id, certs)
        db.commit()
        return CertificateSyncResponse(**result.__dict__)

    # Modo pull (opcional).
    try:
        client = CertHubClient.from_env()
        certs = client.list_certificates(org_id=str(org.id), org_slug=getattr(org, "slug", None))
        result = upsert_mirror(db, org.id, certs)
        db.commit()
        return CertificateSyncResponse(**result.__dict__)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error))
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"CertHub request failed: {repr(error)}")
