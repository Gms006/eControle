from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    user_id: str | None = None
    event_type: str
    severity: str
    title: str
    message: str
    entity_type: str | None = None
    entity_id: str | None = None
    route_path: str | None = None
    dedupe_key: str
    metadata_json: dict | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationEventOut] = Field(default_factory=list)
    total: int
    limit: int
    offset: int


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int = 0


class NotificationReadResponse(BaseModel):
    id: str
    read_at: datetime


class NotificationOperationalScanStartResponse(BaseModel):
    run_id: str
    status: str
