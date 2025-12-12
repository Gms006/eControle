from __future__ import annotations

import logging
import os
from typing import Any, Callable

import redis
from rq import Queue

import re
import hashlib

logger = logging.getLogger(__name__)

QUEUE_NAME_ENV = "RQ_QUEUE_NAME"
DEFAULT_QUEUE_NAME = "econtrole"


_redis_client: redis.Redis | None = None
_queue: Queue | None = None

def sanitize_job_id(raw: str) -> str:
    # RQ >= 2.1.0: job.id não pode conter ':'
    safe = raw.replace(":", "__")
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", safe)
    if len(safe) > 200:
        digest = hashlib.sha1(safe.encode("utf-8")).hexdigest()[:16]
        safe = f"{safe[:180]}_{digest}"
    return safe

def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = redis.from_url(url)
    return _redis_client


def get_queue() -> Queue:
    global _queue
    if _queue is None:
        queue_name = os.getenv(QUEUE_NAME_ENV, DEFAULT_QUEUE_NAME)
        _queue = Queue(name=queue_name, connection=get_redis())
    return _queue


def enqueue_unique(
    job_func: Callable[..., Any],
    job_id: str,
    kwargs: dict[str, Any] | None = None,
    ttl: int | None = None,
    result_ttl: int | None = 3600,
):
    """Enfileira um job com deduplicação por ``job_id``.

    Se já houver um job com mesmo id em estado ativo, o reuso é sinalizado via log.
    """

    queue = get_queue()
    safe_id = sanitize_job_id(job_id)
    existing = queue.fetch_job(safe_id)
    if existing:
        status = existing.get_status(refresh=True)
        if status in {"queued", "started", "deferred"}:
            logger.info("Job duplicado ignorado: job_id=%s status=%s", safe_id, status)
            return existing
        try:
            existing.cancel()
            existing.delete()
        except Exception:  # noqa: BLE001
            logger.warning("Falha ao limpar job antigo: job_id=%s", safe_id, exc_info=True)

    job = queue.enqueue(
        job_func,
        job_id=safe_id,
        ttl=ttl,
        result_ttl=result_ttl,
        **(kwargs or {}),
    )
    logger.info("Job enfileirado: job_id=%s queue=%s", safe_id, queue.name)
    return job
