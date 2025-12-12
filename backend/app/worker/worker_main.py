from __future__ import annotations

import logging
import os

from rq import Queue, Worker
from rq import SimpleWorker  # Windows compatibility

from app.worker import jobs_certificados, jobs_licencas
from app.worker.queue import get_queue, get_redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    redis_conn = get_redis()
    queue = get_queue()
    logger.info("Conexão com Redis estabelecida: %s", redis_conn)
    logger.info("Fila em uso: %s", queue.name)
    logger.info(
        "Jobs disponíveis: %s",
        [
            "app.worker.jobs_certificados.processar_certificado_por_arquivo",
            "app.worker.jobs_certificados.ingest_certificados_full",
            "app.worker.jobs_licencas.reprocessar_licencas_por_empresa",
            "app.worker.jobs_licencas.ingest_licencas_full",
        ],
    )
    queue = Queue("econtrole", connection=redis_conn)

    # Windows: SimpleWorker (compatível com Windows)
    worker_class = SimpleWorker if os.name == "nt" else Worker
    worker = worker_class([queue], connection=redis_conn)
    worker.work()


if __name__ == "__main__":
    main()
