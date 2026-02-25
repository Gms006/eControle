from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_tax import CompanyTax
from app.services.ingest.utils import normalize_cnpj, null_if_marker


def upsert_taxes(db: Session, org_id: str, items: list[dict]) -> tuple[int, int, int]:
    inserted = 0
    updated = 0
    skipped = 0
    pending_by_company_id: dict[str, CompanyTax] = {}

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
            "data_envio": null_if_marker(item.get("data_envio")),
            "taxa_funcionamento": null_if_marker(item.get("taxa_funcionamento")),
            "taxa_publicidade": null_if_marker(item.get("taxa_publicidade")),
            "taxa_vig_sanitaria": null_if_marker(item.get("taxa_vig_sanitaria")),
            "iss": null_if_marker(item.get("iss")),
            "taxa_localiz_instalacao": null_if_marker(item.get("taxa_localiz_instalacao")),
            "taxa_ocup_area_publica": null_if_marker(item.get("taxa_ocup_area_publica")),
            "taxa_bombeiros": null_if_marker(item.get("taxa_bombeiros")),
            "tpi": null_if_marker(item.get("tpi")),
            "vencimento_tpi": null_if_marker(item.get("vencimento_tpi")),
            "status_taxas": null_if_marker(item.get("status_taxas")),
            "raw": item.get("raw"),
        }

        existing = pending_by_company_id.get(str(company.id))
        if existing is None:
            existing = (
                db.query(CompanyTax)
                .filter(CompanyTax.org_id == org_id, CompanyTax.company_id == company.id)
                .first()
            )
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            updated += 1
        else:
            obj = CompanyTax(org_id=org_id, company_id=company.id, **payload)
            db.add(obj)
            pending_by_company_id[str(company.id)] = obj
            inserted += 1

    return inserted, updated, skipped
