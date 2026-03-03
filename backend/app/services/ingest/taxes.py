from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.normalization import normalize_date_br, normalize_generic_status
from app.models.company import Company
from app.models.company_tax import CompanyTax
from app.services.ingest.utils import normalize_cnpj, null_if_marker, sanitize_text_tree


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
            "data_envio": normalize_date_br(null_if_marker(item.get("data_envio")), strict=False),
            "taxa_funcionamento": normalize_generic_status(null_if_marker(item.get("taxa_funcionamento")), strict=False),
            "taxa_publicidade": normalize_generic_status(null_if_marker(item.get("taxa_publicidade")), strict=False),
            "taxa_vig_sanitaria": normalize_generic_status(null_if_marker(item.get("taxa_vig_sanitaria")), strict=False),
            "iss": normalize_generic_status(null_if_marker(item.get("iss")), strict=False),
            "taxa_localiz_instalacao": normalize_generic_status(null_if_marker(item.get("taxa_localiz_instalacao")), strict=False),
            "taxa_ocup_area_publica": normalize_generic_status(null_if_marker(item.get("taxa_ocup_area_publica")), strict=False),
            "taxa_bombeiros": normalize_generic_status(null_if_marker(item.get("taxa_bombeiros")), strict=False),
            "tpi": normalize_generic_status(null_if_marker(item.get("tpi")), strict=False),
            "vencimento_tpi": null_if_marker(item.get("vencimento_tpi")),
            "status_taxas": normalize_generic_status(null_if_marker(item.get("status_taxas")), strict=False),
            "raw": sanitize_text_tree(item.get("raw")),
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
