from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company_licence import CompanyLicence
from app.models.org import Org

router = APIRouter()

LICENCE_FIELDS = (
    "alvara_vig_sanitaria",
    "cercon",
    "alvara_funcionamento",
    "licenca_ambiental",
    "certidao_uso_solo",
)


def _first_day_of_month(value: date) -> date:
    return date(value.year, value.month, 1)


def _add_months(value: date, months: int) -> date:
    month_index = (value.year * 12 + (value.month - 1)) + months
    year = month_index // 12
    month = (month_index % 12) + 1
    return date(year, month, 1)


def _parse_validade(raw: object) -> date | None:
    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


@router.get("")
def list_alertas(
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
):
    return {"items": [], "total": 0, "page": 1, "size": 0}


@router.get("/tendencia")
def list_alertas_tendencia(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    months: int = Query(default=12, ge=6, le=24),
    months_back: int = Query(default=5, ge=0, le=18),
):
    today = date.today()
    anchor = _first_day_of_month(today)
    start_month = _add_months(anchor, -months_back)

    licences = db.query(CompanyLicence).filter(CompanyLicence.org_id == org.id).all()

    entries: list[tuple[date | None, str]] = []
    for licence in licences:
        raw = licence.raw if isinstance(licence.raw, dict) else {}
        for field in LICENCE_FIELDS:
            status = str(getattr(licence, field) or "").strip().lower()
            if status in {"", "nao_exigido"}:
                continue
            validade = _parse_validade(raw.get(f"validade_{field}") or raw.get(f"{field}_validade"))
            entries.append((validade, status))

    items: list[dict[str, object]] = []
    for index in range(months):
        month_start = _add_months(start_month, index)
        next_month = _add_months(month_start, 1)

        alertas_vencendo = sum(
            1 for validade, _status in entries if validade is not None and month_start <= validade < next_month
        )
        alertas_vencidas = sum(1 for validade, _status in entries if validade is not None and validade < month_start)

        # itens sem validade, mas já marcados como vencidos entram no mês corrente
        if month_start == anchor:
            alertas_vencidas += sum(1 for validade, status in entries if validade is None and "vencid" in status)

        items.append(
            {
                "mes": month_start.isoformat(),
                "alertas_vencendo": alertas_vencendo,
                "alertas_vencidas": alertas_vencidas,
            }
        )

    return {"items": items}
