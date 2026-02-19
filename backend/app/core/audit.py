import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AuditEvent:
    action: str
    entity: str
    entity_id: str
    actor_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


def record_audit_event(event: AuditEvent) -> None:
    """
    Stub for audit recording. No persistence in S2.
    """
    logger.info(
        "audit_event action=%s entity=%s entity_id=%s actor_id=%s",
        event.action,
        event.entity,
        event.entity_id,
        event.actor_id,
    )
