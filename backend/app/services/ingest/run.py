from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingest_run import IngestRun
from app.services.ingest.companies import upsert_companies
from app.services.ingest.company_profiles import upsert_company_profiles
from app.services.ingest.licences import upsert_licences
from app.services.ingest.processes import upsert_processes
from app.services.ingest.taxes import upsert_taxes


def run_ingest_companies(
    *,
    db: Session,
    org_id: str,
    source: dict,
    source_hash: str | None,
    companies: list[dict],
    licences: list[dict],
    taxes: list[dict],
    processes: list[dict],
) -> IngestRun:
    ingest_run = IngestRun(
        org_id=org_id,
        dataset="companies",
        source_type=source.get("type"),
        source_name=source.get("name"),
        source_version=source.get("version"),
        generated_at=source.get("generated_at"),
        source_hash=source_hash,
        status="SUCCESS",
        stats=None,
        error=None,
    )

    db.add(ingest_run)
    db.flush()  # ensures ingest_run.id is available before commit

    c_ins, c_upd = upsert_companies(db, org_id, companies)
    # Important: ensure inserted companies are flushed before dependent upserts
    # (profiles/licences/taxes/processes query companies by cnpj to resolve company_id)
    db.flush()
    p_ins, p_upd = upsert_company_profiles(db, org_id, companies)
    l_ins, l_upd, l_skip = upsert_licences(db, org_id, licences)
    t_ins, t_upd, t_skip = upsert_taxes(db, org_id, taxes)
    pr_ins, pr_upd, pr_skip = upsert_processes(db, org_id, processes)

    ingest_run.stats = {
        "companies": {"inserted": c_ins, "updated": c_upd, "total": len(companies)},
        "profiles": {"inserted": p_ins, "updated": p_upd, "total": len(companies)},
        "licences": {"inserted": l_ins, "updated": l_upd, "total": len(licences), "skipped": l_skip},
        "taxes": {"inserted": t_ins, "updated": t_upd, "total": len(taxes), "skipped": t_skip},
        "processes": {"inserted": pr_ins, "updated": pr_upd, "total": len(processes), "skipped": pr_skip},
    }
    return ingest_run
