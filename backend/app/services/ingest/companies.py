from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.fs_dirname import normalize_fs_dirname
from app.core.normalization import normalize_municipio, normalize_title_case
from app.models.company import Company
from app.services.ingest.utils import normalize_cnpj, repair_mojibake_utf8


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

        razao_social = repair_mojibake_utf8(item.get("razao_social") or item.get("empresa"))
        if not razao_social:
            # minimum domain requirement for companies
            continue

        payload = {
            "cnpj": cnpj,
            "razao_social": normalize_title_case(razao_social) or razao_social,
            "nome_fantasia": normalize_title_case(repair_mojibake_utf8(item.get("nome_fantasia"))),
            "municipio": normalize_municipio(repair_mojibake_utf8(item.get("municipio"))),
            "uf": repair_mojibake_utf8(item.get("uf")),
        }

        fs_dirname_raw = item.get("fs_dirname")
        if fs_dirname_raw is None and "alias" in item:
            fs_dirname_raw = item.get("alias")
        if "fs_dirname" in item or "alias" in item:
            payload["fs_dirname"] = normalize_fs_dirname(repair_mojibake_utf8(fs_dirname_raw))

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
