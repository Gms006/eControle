from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class AdminUserOut(BaseModel):
    id: str
    email: EmailStr
    org_id: str
    is_active: bool
    roles: List[str]
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    roles: List[str] = Field(default_factory=list)
    is_active: Optional[bool] = None


class AdminUserUpdate(BaseModel):
    roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
