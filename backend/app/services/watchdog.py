"""Monitoramento de diretórios para ingestão automática de certificados."""

from __future__ import annotations

import logging
import time
from typing import Callable

from sqlalchemy.orm import Session
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.services.certificados_ingest import ingest_certificados

logger = logging.getLogger(__name__)


class CertificadosHandler(FileSystemEventHandler):
    def __init__(self, certificados_dir: str, org_id: str, session_factory: Callable[[], Session]):
        super().__init__()
        self.certificados_dir = certificados_dir
        self.org_id = org_id
        self.session_factory = session_factory

    def on_created(self, event):
        if event.is_directory or not event.src_path.lower().endswith(".pfx"):
            return
        logger.info("Novo certificado detectado: %s", event.src_path)
        with self.session_factory() as db:
            ingest_certificados(self.certificados_dir, self.org_id, db)


def start_watcher(certificados_dir: str, org_id: str, session_factory: Callable[[], Session]) -> None:
    """Inicia o watcher do diretório informado."""

    event_handler = CertificadosHandler(certificados_dir, org_id, session_factory)
    observer = Observer()
    observer.schedule(event_handler, certificados_dir, recursive=True)
    observer.start()
    logger.info("Watcher iniciado em %s", certificados_dir)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Watcher interrompido pelo usuário")
        observer.stop()
    finally:
        observer.join()
