"""Serviços de alerta para CNDs."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.cnds import Cnd
from app.utils.email_utils import send_email

logger = logging.getLogger(__name__)


def send_email_alert_cnds(cnds: Iterable[Cnd]) -> None:
    corpo = ""
    for cnd in cnds:
        corpo += (
            f"CND: {cnd.orgao}\n"
            f"Esfera: {cnd.esfera}\n"
            f"Validade: {cnd.validade}\n"
            f"Status: {cnd.status}\n\n"
        )

    if not corpo:
        logger.info("Nenhuma CND a notificar.")
        return

    send_email(
        subject="Alertas de CNDs Vencendo",
        body=corpo,
        recipients=["cadastro@netocontabilidade.com.br"],
    )


def send_alerts_cnds(db: Session, dias_restantes: int = 15) -> int:
    """Envia alertas para CNDs cujo vencimento está próximo."""

    limite = date.today() + timedelta(days=dias_restantes)
    cnds = (
        db.query(Cnd)
        .filter(and_(Cnd.validade.is_not(None), Cnd.validade <= limite))
        .order_by(Cnd.validade)
        .all()
    )

    if not cnds:
        logger.info("Nenhuma CND com vencimento até %s", limite)
        return 0

    send_email_alert_cnds(cnds)
    return len(cnds)
