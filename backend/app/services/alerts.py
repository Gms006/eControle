"""Envio de alertas para certificados próximos do vencimento."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.certificados import Certificado
from app.utils.email_utils import send_email

logger = logging.getLogger(__name__)


def _format_certificados(certificados: Iterable[Certificado]) -> str:
    linhas: list[str] = []
    today = date.today()
    for cert in certificados:
        dias_restantes = (cert.valido_ate - today).days if cert.valido_ate else "?"
        linhas.append(
            "\n".join(
                [
                    f"Certificado: {cert.subject or cert.serial}",
                    f"Válido Até: {cert.valido_ate}",
                    f"Dias Restantes: {dias_restantes}",
                ]
            )
        )
    return "\n\n".join(linhas)


def send_email_alert(certificados: Iterable[Certificado]) -> None:
    corpo = _format_certificados(certificados)
    if not corpo:
        logger.info("Nenhum certificado para alertar.")
        return

    send_email(
        subject="Alertas de Certificados Vencendo",
        body=corpo,
        recipients=["cadastro@netocontabilidade.com.br"],
    )


def send_alerts_certificados(db: Session) -> int:
    """Envia alertas para certificados com vencimento em 15 dias ou menos."""

    limite = date.today() + timedelta(days=15)
    certificados = (
        db.query(Certificado)
        .filter(and_(Certificado.valido_ate.is_not(None), Certificado.valido_ate <= limite))
        .order_by(Certificado.valido_ate)
        .all()
    )

    if not certificados:
        logger.info("Nenhum certificado encontrado para alerta até %s", limite)
        return 0

    send_email_alert(certificados)
    return len(certificados)
