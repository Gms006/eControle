from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from rq.job import Job

from app.deps.auth import Role, require_role
from app.worker.queue import get_queue, get_redis

router = APIRouter(prefix="/worker", tags=["Worker"])
logger = logging.getLogger(__name__)


@router.get("/health")
def worker_health(_: str = Depends(require_role(Role.ADMIN))) -> dict[str, object]:
    try:
        redis_conn = get_redis()
        redis_conn.ping()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao pingar Redis")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    queue = get_queue()
    return {"redis": "ok", "queue": queue.name}


@router.get("/jobs/{job_id}")
def job_status(job_id: str, _: str = Depends(require_role(Role.ADMIN))) -> dict[str, object]:
    queue = get_queue()
    job: Job | None = queue.fetch_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado")

    status_value = job.get_status(refresh=True)
    enqueued_at = job.enqueued_at.isoformat() if job.enqueued_at else None
    started_at = job.started_at.isoformat() if job.started_at else None
    ended_at = job.ended_at.isoformat() if job.ended_at else None
    return {
        "job_id": job_id,
        "status": status_value,
        "enqueued_at": enqueued_at,
        "started_at": started_at,
        "ended_at": ended_at,
    }
