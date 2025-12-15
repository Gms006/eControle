from __future__ import annotations

import logging
import os
import time
from collections import deque
from hashlib import sha1
from pathlib import Path
from typing import Callable
from uuid import UUID

from dotenv import load_dotenv
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.db.session import SessionLocal
from app.services.licencas_ingest import resolve_empresa_id_por_dir
from app.worker import jobs_certificados
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
    def __init__(self, org_id: str, debounce_seconds: float, max_events_per_minute: int | None, certificados_root: str):
        super().__init__(debounce_seconds, max_events_per_minute)
        self.org_id = org_id
        self.certificados_root = Path(certificados_root)

    def on_created(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_created(event)

    def on_modified(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_created(event)

    def on_deleted(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_deleted(event)

    def on_moved(self, event: FileSystemEvent) -> None:  # noqa: D401
        self._handle_moved(event)

    def _is_in_root(self, path: str) -> bool:
        """Verifica se o arquivo está na raiz (sem subpastas)."""
        try:
            relative = Path(path).resolve().relative_to(self.certificados_root.resolve())
            # Se tem partes, significa que está em subpasta
            return len(relative.parts) == 1
        except ValueError:
            return False

    def _handle_created(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pfx"):
            return
        
        # Apenas processar se estiver na raiz
        if not self._is_in_root(event.src_path):
            logger.debug("Certificado em subpasta ignorado: %s", event.src_path)
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

    def _handle_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pfx"):
            return
        
        # Apenas processar se estava na raiz
        if not self._is_in_root(event.src_path):
            logger.debug("Deletado em subpasta ignorado: %s", event.src_path)
            return
        
        path_norm = os.path.normpath(event.src_path)
        key = path_norm.lower()
        if self._should_skip(key):
            return

        job_id = f"cert_del:{self.org_id}:{sha1(key.encode()).hexdigest()}"
        logger.info("Evento de deleção de certificado detectado: %s", path_norm)
        enqueue_unique(
            jobs_certificados.remover_certificado_por_caminho,
            job_id=job_id,
            kwargs={"org_id": self.org_id, "caminho_arquivo": path_norm},
        )

    def _handle_moved(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pfx"):
            return
        
        path_norm = os.path.normpath(event.src_path)
        dest_path = os.path.normpath(event.dest_path) if hasattr(event, 'dest_path') else None
        
        src_in_root = self._is_in_root(event.src_path)
        dest_in_root = self._is_in_root(dest_path) if dest_path else False
        
        # Se saiu da raiz → remover
        if src_in_root and not dest_in_root:
            key = path_norm.lower()
            if self._should_skip(key):
                return
            
            job_id = f"cert_del:{self.org_id}:{sha1(key.encode()).hexdigest()}"
            logger.info("Certificado movido para fora da raiz, enfileirando delete: %s -> %s", path_norm, dest_path)
            enqueue_unique(
                jobs_certificados.remover_certificado_por_caminho,
                job_id=job_id,
                kwargs={"org_id": self.org_id, "caminho_arquivo": path_norm},
            )
        # Se entrou na raiz → processar
        elif not src_in_root and dest_in_root:
            key = dest_path.lower()
            if self._should_skip(key):
                return
            
            job_id = f"cert:{self.org_id}:{sha1(key.encode()).hexdigest()}"
            logger.info("Certificado movido para raiz, enfileirando processamento: %s -> %s", path_norm, dest_path)
            enqueue_unique(
                processar_certificado_por_arquivo,
                job_id=job_id,
                kwargs={"org_id": self.org_id, "caminho_arquivo": dest_path},
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
    env_org = os.getenv(ORG_DEFAULT_ENV) or os.getenv("ORG_ID")
    if env_org:
        return env_org
    raise ValueError("org_id é obrigatório para iniciar watcher")


def _start_observer(path: Path, handler_factory: Callable[[], FileSystemEventHandler]) -> Observer:
    handler = handler_factory()
    observer = Observer()
    observer.schedule(handler, str(path), recursive=True)
    observer.start()
    logger.info("Watcher iniciado em %s", path)
    return observer


def start_certificados_watcher(
    org_id: str | None,
    certificados_root: str,
    debounce_seconds: float | None = None,
    max_events_per_minute: int | None = None,
) -> Observer:
    org_resolvido = _resolve_org_id(org_id)
    debounce = _debounce_seconds(debounce_seconds)
    rate_limit = _max_events_per_minute(max_events_per_minute)
    path = Path(certificados_root)
    logger.info(
        "Watcher de certificados configurado: org_id=%s root=%s debounce=%ss rate_limit=%s (sem recursão)",
        org_resolvido,
        path,
        debounce,
        rate_limit,
    )

    def factory() -> FileSystemEventHandler:
        return CertificadosHandler(org_resolvido, debounce, rate_limit, certificados_root)

    # Monitorar apenas a raiz (recursive=False)
    handler = factory()
    observer = Observer()
    observer.schedule(handler, str(path), recursive=False)
    observer.start()
    logger.info("Watcher de certificados iniciado em %s (sem recursão)", path)
    return observer


def start_licencas_watcher(
    org_id: str | None,
    licencas_root: str,
    debounce_seconds: float | None = None,
    max_events_per_minute: int | None = None,
) -> Observer:
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

    return _start_observer(path, factory)


def main() -> None:
    """Inicia os watchers de certificados e licenças."""
    # Carregar .env (procura a partir do diretório backend)
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(str(env_path))
    
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
    
    # Resolver org_id
    org_id = _resolve_org_id(None)
    logger.info("org_id resolvido: %s", org_id)
    
    # Resolver caminhos para certificados
    certificados_root = os.getenv("CERTIFICADOS_ROOT") or os.getenv("ECONTROLE_CERTIFICADOS_DIR")
    if not certificados_root:
        raise ValueError("CERTIFICADOS_ROOT ou ECONTROLE_CERTIFICADOS_DIR não configurado")
    
    # Resolver caminhos para licenças
    licencas_root = os.getenv("LICENCAS_ROOT") or os.getenv("EMPRESAS_ROOT_DIR")
    if not licencas_root:
        raise ValueError("LICENCAS_ROOT ou EMPRESAS_ROOT_DIR não configurado")
    
    # Validar diretórios
    cert_path = Path(certificados_root)
    lic_path = Path(licencas_root)
    
    if not cert_path.exists():
        raise ValueError(f"Diretório de certificados não existe: {certificados_root}")
    if not lic_path.exists():
        raise ValueError(f"Diretório de licenças não existe: {licencas_root}")
    
    logger.info("Iniciando watchers...")
    logger.info("  Certificados: %s", cert_path)
    logger.info("  Licenças: %s", lic_path)
    
    # Iniciar observers
    obs_certificados = start_certificados_watcher(org_id, certificados_root)
    obs_licencas = start_licencas_watcher(org_id, licencas_root)
    
    observers = [obs_certificados, obs_licencas]
    
    logger.info("Todos os watchers iniciados com sucesso!")
    logger.info("Pressione Ctrl+C para encerrar.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Encerrando watchers...")
        for obs in observers:
            obs.stop()
        for obs in observers:
            obs.join()
        logger.info("Watchers encerrados com sucesso!")


if __name__ == "__main__":
    main()
