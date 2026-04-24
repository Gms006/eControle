from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DashboardSavedView(Base):
    __tablename__ = "dashboard_saved_views"

    __table_args__ = (
        Index("ix_dashboard_saved_views_org_tab", "org_id", "tab_key"),
        Index("ix_dashboard_saved_views_org_scope", "org_id", "scope"),
        Index("ix_dashboard_saved_views_org_user", "org_id", "created_by_user_id"),
        Index("ix_dashboard_saved_views_org_pinned", "org_id", "is_pinned"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("orgs.id"), nullable=False, index=True)
    created_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    tab_key: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'painel'"))
    scope: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'personal'"))
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
