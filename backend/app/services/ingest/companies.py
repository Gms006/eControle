from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.company import Company
from app.services.ingest.utils import normalize_cnpj


def upsert_companies(db: Session, org_id: str, items: list[dict]) -> tuple[int, int]:
    """
    Idempotent upsert by (org_id, cnpj).
    Returns (inserted, updated).
    """
    inserted = 0
    updated = 0

    for item in items:
        cnpj = normalize_cnpj(item.get("cnpj", ""))
        if not cnpj:
            continue

        razao_social = item.get("razao_social") or item.get("empresa")
        if not razao_social:
            # minimum domain requirement for companies
            continue

        payload = {
            "cnpj": cnpj,
            "razao_social": razao_social,
            "nome_fantasia": item.get("nome_fantasia"),
            "municipio": item.get("municipio"),
            "uf": item.get("uf"),
        }

        if "is_active" in item and item["is_active"] is not None:
            payload["is_active"] = bool(item["is_active"])

        existing = (
            db.query(Company)
            .filter(Company.org_id == org_id)
            .filter(Company.cnpj == cnpj)
            .first()
        )

        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(Company(org_id=org_id, **payload))
            inserted += 1

    return inserted, updated
