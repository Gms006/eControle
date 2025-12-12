from __future__ import annotations

import logging
import os
import time
from collections import deque
from hashlib import sha1
from pathlib import Path
from typing import Callable
from uuid import UUID

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.db.session import SessionLocal
from app.services.licencas_ingest import resolve_empresa_id_por_dir
from app.worker.jobs_certificados import processar_certificado_por_arquivo
from app.worker.jobs_licencas import reprocessar_licencas_por_empresa
from app.worker.queue import enqueue_unique

logger = logging.getLogger(__name__)

DEBOUNCE_ENV = "WATCHER_DEBOUNCE_SECONDS"
RATE_LIMIT_ENV = "WATCHER_MAX_EVENTS_PER_MINUTE"
ORG_DEFAULT_ENV = "ORG_ID_DEFAULT"

ALLOWED_LICENSE_EXTS = {".pdf", ".png", ".jpg", ".jpeg"}


class DebouncedHandler(FileSystemEventHandler):
    def __init__(self, debounce_seconds: float, max_events_per_minute: int | None = None):
        super().__init__()
        self.debounce_seconds = debounce_seconds
        self.max_events_per_minute = max_events_per_minute
        self.last_event: dict[str, float] = {}
        self.events_window: deque[float] = deque()

    def _should_skip(self, key: str) -> bool:
        now = time.monotonic()
        last = self.last_event.get(key)
        if last and now - last < self.debounce_seconds:
            logger.debug("Evento ignorado por debounce: %s", key)
            return True

        if self.max_events_per_minute:
            while self.events_window and self.events_window[0] < now - 60:
                self.events_window.popleft()
            if len(self.events_window) >= self.max_events_per_minute:
                logger.warning("Rate limit atingido. Evento ignorado: %s", key)
                return True
            self.events_window.append(now)

        self.last_event[key] = now
        return False


class CertificadosHandler(DebouncedHandler):
    def __init__(self, org_id: str, debounce_seconds: float, max_events_per_minute: int | None):
        super().__init__(debounce_seconds, max_events_per_minute)
        self.org_id = org_id

    def on_created(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_event(event)

    def on_modified(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_event(event)

    def _handle_event(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pfx"):
            return
        path_norm = os.path.normpath(event.src_path)
        key = path_norm.lower()
        if self._should_skip(key):
            return

        job_id = f"cert:{self.org_id}:{sha1(key.encode()).hexdigest()}"
        logger.info("Evento de certificado detectado: %s", path_norm)
        enqueue_unique(
            processar_certificado_por_arquivo,
            job_id=job_id,
            kwargs={"org_id": self.org_id, "caminho_arquivo": path_norm},
        )


class LicencasHandler(DebouncedHandler):
    def __init__(
        self,
        org_id: str,
        licencas_root: Path,
        debounce_seconds: float,
        max_events_per_minute: int | None,
    ):
        super().__init__(debounce_seconds, max_events_per_minute)
        self.org_id = org_id
        self.licencas_root = licencas_root

    def on_created(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_event(event)

    def on_modified(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_event(event)

    def _extract_empresa_dir(self, path: Path) -> Path | None:
        try:
            relative = path.resolve().relative_to(self.licencas_root.resolve())
        except ValueError:
            return None
        parts = relative.parts
        if len(parts) < 3:
            return None
        if "societário" not in {p.lower() for p in parts}:
            return None
        if "alvarás e certidões" not in {p.lower() for p in parts}:
            return None
        return self.licencas_root / parts[0]

    def _handle_event(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in ALLOWED_LICENSE_EXTS:
            return

        empresa_dir = self._extract_empresa_dir(path)
        if not empresa_dir:
            return

        key = str(path.resolve()).lower()
        if self._should_skip(key):
            return

        empresa_id = None
        org_uuid = None
        try:
            org_uuid = UUID(self.org_id)
        except Exception:  # noqa: BLE001
            logger.warning("org_id inválido para resolução de empresa: %s", self.org_id)

        if org_uuid:
            with SessionLocal() as db:
                try:
                    empresa_id = resolve_empresa_id_por_dir(db, org_uuid, empresa_dir)
                except Exception:  # noqa: BLE001
                    logger.exception("Falha ao resolver empresa para %s", empresa_dir)

        job_key = (
            f"lic:{self.org_id}:{empresa_id}" if empresa_id is not None else f"lic:{self.org_id}:{sha1(str(empresa_dir).lower().encode()).hexdigest()}"
        )
        logger.info(
            "Evento de licença detectado: caminho=%s empresa_dir=%s empresa_id=%s",
            path,
            empresa_dir,
            empresa_id,
        )
        enqueue_unique(
            reprocessar_licencas_por_empresa,
            job_id=job_key,
            kwargs={
                "org_id": self.org_id,
                "empresa_id": empresa_id,
                "empresa_dir": str(empresa_dir),
                "licencas_root": str(self.licencas_root),
            },
        )


def _debounce_seconds(debounce: float | None) -> float:
    if debounce is not None:
        return debounce
    env = os.getenv(DEBOUNCE_ENV)
    return float(env) if env else 3.0


def _max_events_per_minute(default: int | None = None) -> int | None:
    env_value = os.getenv(RATE_LIMIT_ENV)
    if env_value:
        try:
            return int(env_value)
        except ValueError:
            logger.warning("WATCHER_MAX_EVENTS_PER_MINUTE inválido: %s", env_value)
    return default


def _resolve_org_id(org_id: str | None) -> str:
    if org_id:
        return org_id
    env_org = os.getenv(ORG_DEFAULT_ENV)
    if env_org:
        return env_org
    raise ValueError("org_id é obrigatório para iniciar watcher")


def _start_observer(path: Path, handler_factory: Callable[[], FileSystemEventHandler]) -> None:
    handler = handler_factory()
    observer = Observer()
    observer.schedule(handler, str(path), recursive=True)
    observer.start()
    logger.info("Watcher iniciado em %s", path)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Watcher interrompido pelo usuário")
        observer.stop()
    finally:
        observer.join()


def start_certificados_watcher(
    org_id: str | None,
    certificados_root: str,
    debounce_seconds: float | None = None,
    max_events_per_minute: int | None = None,
) -> None:
    org_resolvido = _resolve_org_id(org_id)
    debounce = _debounce_seconds(debounce_seconds)
    rate_limit = _max_events_per_minute(max_events_per_minute)
    path = Path(certificados_root)
    logger.info(
        "Watcher de certificados configurado: org_id=%s root=%s debounce=%ss rate_limit=%s",
        org_resolvido,
        path,
        debounce,
        rate_limit,
    )

    def factory() -> FileSystemEventHandler:
        return CertificadosHandler(org_resolvido, debounce, rate_limit)

    _start_observer(path, factory)


def start_licencas_watcher(
    org_id: str | None,
    licencas_root: str,
    debounce_seconds: float | None = None,
    max_events_per_minute: int | None = None,
) -> None:
    org_resolvido = _resolve_org_id(org_id)
    debounce = _debounce_seconds(debounce_seconds)
    rate_limit = _max_events_per_minute(max_events_per_minute)
    path = Path(licencas_root)
    logger.info(
        "Watcher de licenças configurado: org_id=%s root=%s debounce=%ss rate_limit=%s",
        org_resolvido,
        path,
        debounce,
        rate_limit,
    )

    def factory() -> FileSystemEventHandler:
        return LicencasHandler(org_resolvido, path, debounce, rate_limit)

    _start_observer(path, factory)
