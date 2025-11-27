"""Funções auxiliares para envio de e-mails de alerta."""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.text import MIMEText
from typing import Iterable, List

logger = logging.getLogger(__name__)


def send_email(
    *,
    subject: str,
    body: str,
    recipients: Iterable[str],
    sender: str | None = None,
    smtp_host: str | None = None,
    smtp_port: int | None = None,
    username: str | None = None,
    password: str | None = None,
    use_tls: bool = True,
) -> None:
    """
    Envia um e-mail de texto simples utilizando SMTP.

    Os parâmetros de servidor podem ser definidos via argumentos ou pelas variáveis
    de ambiente ``SMTP_HOST``, ``SMTP_PORT``, ``SMTP_USERNAME``, ``SMTP_PASSWORD`` e
    ``SMTP_SENDER``. Quando algum parâmetro obrigatório não está presente, o envio
    é ignorado e um aviso é registrado para evitar falhas silenciosas em jobs de
    alerta.
    """

    mail_host = smtp_host or os.getenv("SMTP_HOST")
    mail_port = int(os.getenv("SMTP_PORT", "0")) or smtp_port or 587
    mail_user = username or os.getenv("SMTP_USERNAME")
    mail_pass = password or os.getenv("SMTP_PASSWORD")
    mail_sender = sender or os.getenv("SMTP_SENDER") or mail_user

    if not mail_host or not mail_sender:
        logger.warning(
            "Envio de e-mail ignorado: configurações de SMTP ausentes (host/sender)."
        )
        return

    to_list: List[str] = [address for address in recipients if address]
    if not to_list:
        logger.warning("Envio de e-mail ignorado: lista de destinatários vazia.")
        return

    message = MIMEText(body, _charset="utf-8")
    message["Subject"] = subject
    message["From"] = mail_sender
    message["To"] = ", ".join(to_list)

    logger.info(
        "Enviando e-mail de alerta: subject=%s recipients=%s host=%s port=%s",
        subject,
        to_list,
        mail_host,
        mail_port,
    )

    with smtplib.SMTP(mail_host, mail_port, timeout=15) as server:
        if use_tls:
            server.starttls()
        if mail_user and mail_pass:
            server.login(mail_user, mail_pass)
        server.sendmail(mail_sender, to_list, message.as_string())
