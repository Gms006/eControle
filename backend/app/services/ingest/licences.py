from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_licence import CompanyLicence
from app.services.ingest.utils import normalize_cnpj, null_if_marker


def upsert_licences(db: Session, org_id: str, items: list[dict]) -> tuple[int, int, int]:
    inserted = 0
    updated = 0
    skipped = 0

    for item in items:
        cnpj = normalize_cnpj(item.get("cnpj", ""))
        if not cnpj:
            skipped += 1
            continue

        company = db.query(Company).filter(Company.org_id == org_id, Company.cnpj == cnpj).first()
        if not company:
            skipped += 1
            continue

        payload = {
            "municipio": null_if_marker(item.get("municipio")),
            "alvara_vig_sanitaria": null_if_marker(item.get("alvara_vig_sanitaria")),
            "cercon": null_if_marker(item.get("cercon")),
            "alvara_funcionamento": null_if_marker(item.get("alvara_funcionamento")),
            "licenca_ambiental": null_if_marker(item.get("licenca_ambiental")),
            "certidao_uso_solo": null_if_marker(item.get("certidao_uso_solo")),
            "raw": item.get("raw"),
        }

        existing = (
            db.query(CompanyLicence)
            .filter(CompanyLicence.org_id == org_id, CompanyLicence.company_id == company.id)
            .first()
        )
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(CompanyLicence(org_id=org_id, company_id=company.id, **payload))
            inserted += 1

    return inserted, updated, skipped

