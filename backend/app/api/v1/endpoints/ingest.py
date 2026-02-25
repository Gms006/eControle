from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.schemas.ingest.companies import CompaniesIngestEnvelope
from app.schemas.ingest.envelopes import LicencesIngestEnvelope, ProcessesIngestEnvelope, TaxesIngestEnvelope
from app.schemas.ingest.common import IngestResult
from app.models.ingest_run import IngestRun
from app.services.ingest.licences import upsert_licences
from app.services.ingest.processes import upsert_processes
from app.services.ingest.run import run_ingest_companies
from app.services.ingest.taxes import upsert_taxes
from app.services.ingest.utils import compute_sha256


router = APIRouter()


def _create_ingest_run(
    *,
    db: Session,
    org_id: str,
    dataset: str,
    source: dict,
    source_hash: str | None,
    stats: dict,
    status_value: str = "SUCCESS",
    error: str | None = None,
) -> IngestRun:
    ingest_run = IngestRun(
        org_id=org_id,
        dataset=dataset,
        source_type=source.get("type"),
        source_name=source.get("name"),
        source_version=source.get("version"),
        generated_at=source.get("generated_at"),
        source_hash=source_hash,
        status=status_value,
        stats=stats,
        error=error,
    )
    db.add(ingest_run)
    db.flush()
    return ingest_run


@router.post("/run", response_model=IngestResult)
async def ingest_run(
    request: Request,
    payload: CompaniesIngestEnvelope,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
    _user=Depends(require_roles("DEV")),
) -> IngestResult:
    # org context is enforced by auth (user.org_id). Payload org.slug is informational only.

    body_bytes = await request.body()
    source_hash = payload.source_hash or compute_sha256(body_bytes)

    try:
        ingest_run_obj = run_ingest_companies(
            db=db,
            org_id=org.id,
            source=payload.source.model_dump(),
            source_hash=source_hash,
            companies=[c.model_dump() for c in payload.companies],
            licences=[l.model_dump() for l in payload.licences],
            taxes=[t.model_dump() for t in payload.taxes],
            processes=[p.model_dump() for p in payload.processes],
        )
        db.commit()
        db.refresh(ingest_run_obj)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingest failed: {exc}")

    stats = ingest_run_obj.stats or {}
    # stats format can be:
    # - legacy flat: {"inserted": x, "updated": y, "total": z}
    # - nested: {"companies": {...}, "profiles": {...}}
    if "companies" in stats and isinstance(stats.get("companies"), dict):
        primary = stats.get("companies") or {}
    else:
        primary = stats
    return IngestResult(
        dataset="companies",
        inserted=int(primary.get("inserted", 0)),
        updated=int(primary.get("updated", 0)),
        total=int(primary.get("total", 0)),
        ingest_run_id=ingest_run_obj.id,
    )


@router.post("/licences", response_model=IngestResult)
async def ingest_licences(
    request: Request,
    payload: LicencesIngestEnvelope,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
    _user=Depends(require_roles("DEV")),
) -> IngestResult:
    body_bytes = await request.body()
    source_hash = payload.source_hash or compute_sha256(body_bytes)
    try:
        ins, upd, skip = upsert_licences(db, org.id, [x.model_dump() for x in payload.licences])
        ingest_run_obj = _create_ingest_run(
            db=db,
            org_id=org.id,
            dataset="licences",
            source=payload.source.model_dump(),
            source_hash=source_hash,
            stats={"inserted": ins, "updated": upd, "total": len(payload.licences), "skipped": skip},
        )
        db.commit()
        db.refresh(ingest_run_obj)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingest licences failed: {exc}")

    return IngestResult(
        dataset="licences",
        inserted=ins,
        updated=upd,
        total=len(payload.licences),
        ingest_run_id=ingest_run_obj.id,
    )


@router.post("/taxes", response_model=IngestResult)
async def ingest_taxes(
    request: Request,
    payload: TaxesIngestEnvelope,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
    _user=Depends(require_roles("DEV")),
) -> IngestResult:
    body_bytes = await request.body()
    source_hash = payload.source_hash or compute_sha256(body_bytes)
    try:
        ins, upd, skip = upsert_taxes(db, org.id, [x.model_dump() for x in payload.taxes])
        ingest_run_obj = _create_ingest_run(
            db=db,
            org_id=org.id,
            dataset="taxes",
            source=payload.source.model_dump(),
            source_hash=source_hash,
            stats={"inserted": ins, "updated": upd, "total": len(payload.taxes), "skipped": skip},
        )
        db.commit()
        db.refresh(ingest_run_obj)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingest taxes failed: {exc}")

    return IngestResult(
        dataset="taxes",
        inserted=ins,
        updated=upd,
        total=len(payload.taxes),
        ingest_run_id=ingest_run_obj.id,
    )


@router.post("/processes", response_model=IngestResult)
async def ingest_processes(
    request: Request,
    payload: ProcessesIngestEnvelope,
    db: Session = Depends(get_db),
    org=Depends(get_current_org),
    _user=Depends(require_roles("DEV")),
) -> IngestResult:
    body_bytes = await request.body()
    source_hash = payload.source_hash or compute_sha256(body_bytes)
    try:
        ins, upd, skip = upsert_processes(db, org.id, [x.model_dump() for x in payload.processes])
        ingest_run_obj = _create_ingest_run(
            db=db,
            org_id=org.id,
            dataset="processes",
            source=payload.source.model_dump(),
            source_hash=source_hash,
            stats={"inserted": ins, "updated": upd, "total": len(payload.processes), "skipped": skip},
        )
        db.commit()
        db.refresh(ingest_run_obj)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingest processes failed: {exc}")

    return IngestResult(
        dataset="processes",
        inserted=ins,
        updated=upd,
        total=len(payload.processes),
        ingest_run_id=ingest_run_obj.id,
    )
