"""CLI de orquestração da ingestão de certificados (.pfx) para o banco."""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from sqlalchemy.orm import Session

# Adiciona backend ao PYTHONPATH para importações funcionarem em execução direta
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

# Carrega .env antes de importar configurações
from dotenv import load_dotenv

env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from app.db.session import SessionLocal
from app.services.certificados_ingest import ingest_certificados

logger = logging.getLogger(__name__)


def get_session() -> Session:
    return SessionLocal()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingestão de certificados digitais (.pfx) no banco"
    )
    parser.add_argument(
        "--org-id",
        dest="org_id",
        default=os.getenv("ECONTROLE_ORG_ID"),
        help="UUID da organização (ou defina ECONTROLE_ORG_ID no ambiente)",
    )
    parser.add_argument(
        "--cert-dir",
        dest="cert_dir",
        default=os.getenv("CERTIFICADOS_DIR", r"G:\\CERTIFICADOS DIGITAIS"),
        help="Diretório raiz onde estão os arquivos .pfx dos certificados",
    )
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    args = parse_args()

    if not args.org_id:
        logger.error(
            "ORG_ID não informado. Use --org-id ou defina ECONTROLE_ORG_ID no ambiente."
        )
        return 1

    cert_dir = args.cert_dir
    if not os.path.isdir(cert_dir):
        logger.error(f"Diretório de certificados não encontrado: {cert_dir}")
        return 1

    logger.info("Iniciando ingestão de certificados")
    logger.info("Org ID: %s", args.org_id)
    logger.info("Diretório: %s", cert_dir)

    session: Session = get_session()
    try:
        processed = ingest_certificados(cert_dir, args.org_id, session)
        session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Erro durante a ingestão de certificados")
        session.rollback()
        return 1
    finally:
        session.close()

    logger.info("Ingestão concluída. Certificados processados: %s", processed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
