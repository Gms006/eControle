from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_process import CompanyProcess
from app.services.ingest.utils import normalize_cnpj, null_if_marker, sanitize_text_tree


def upsert_processes(db: Session, org_id: str, items: list[dict]) -> tuple[int, int, int]:
    inserted = 0
    updated = 0
    skipped = 0

    for item in items:
        cnpj = normalize_cnpj(item.get("cnpj", ""))
        ptype = (item.get("process_type") or "").strip()
        protocolo = (item.get("protocolo") or "").strip()
        if not cnpj or not ptype or not protocolo:
            skipped += 1
            continue

        company = db.query(Company).filter(Company.org_id == org_id, Company.cnpj == cnpj).first()
        if not company:
            skipped += 1
            continue

        payload = {
            "municipio": null_if_marker(item.get("municipio")),
            "orgao": null_if_marker(item.get("orgao")),
            "operacao": null_if_marker(item.get("operacao")),
            "data_solicitacao": null_if_marker(item.get("data_solicitacao")),
            "situacao": null_if_marker(item.get("situacao")),
            "obs": null_if_marker(item.get("obs")),
            "extra": sanitize_text_tree(item.get("extra")) or None,
            "raw": sanitize_text_tree(item.get("raw")),
        }

        existing = (
            db.query(CompanyProcess)
            .filter(
                CompanyProcess.org_id == org_id,
                CompanyProcess.company_id == company.id,
                CompanyProcess.process_type == ptype,
                CompanyProcess.protocolo == protocolo,
            )
            .first()
        )
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(
                CompanyProcess(
                    org_id=org_id,
                    company_id=company.id,
                    process_type=ptype,
                    protocolo=protocolo,
                    **payload,
                )
            )
            inserted += 1

    return inserted, updated, skipped
