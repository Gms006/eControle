from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


DashboardScope = Literal["personal", "shared"]


class DashboardSavedViewCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    tab_key: str = Field(default="painel", min_length=1, max_length=32)
    scope: DashboardScope = "personal"
    payload_json: dict[str, Any] = Field(default_factory=dict)
    is_pinned: bool = False


class DashboardSavedViewUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    scope: DashboardScope | None = None
    payload_json: dict[str, Any] | None = None
    is_pinned: bool | None = None


class DashboardSavedViewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    created_by_user_id: str
    name: str
    tab_key: str
    scope: DashboardScope
    payload_json: dict[str, Any]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class DashboardSavedViewListResponse(BaseModel):
    items: list[DashboardSavedViewOut] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
