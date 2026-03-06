import os
import inspect
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Iterable, Optional

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.certificate_mirror import CertificateMirror
from app.models.company import Company
from app.models.company_profile import CompanyProfile

logger = logging.getLogger("econtrole.webhook_certhub")
from app.models.org import Org as Organization


def only_digits(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None


def parse_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        raw = v.strip()
        if not raw:
            return None
        # Suporta ISO com sufixo Z.
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None
    return None


def compute_situacao(not_after: Optional[datetime]) -> str:
    if not not_after:
        return "DESCONHECIDO"
    now = datetime.now(timezone.utc)
    days = (not_after.date() - now.date()).days
    if days < 0:
        return "VENCIDO"
    if days <= 7:
        return "ALERTA"
    return "OK"


def _json_safe(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, dict):
        return {k: _json_safe(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_json_safe(x) for x in v]
    return v


@dataclass
class SyncResult:
    received: int
    inserted: int
    updated: int
    mapped_companies: int
    unmapped_cnpjs: int
    updated_company_profiles: int


def build_company_cnpj_map(db: Session, org_id) -> dict[str, Any]:
    """
    Mapa cnpj_digits -> company_id
    """
    rows = db.query(Company.id, Company.cnpj).filter(Company.org_id == org_id).all()
    out: dict[str, Any] = {}
    for company_id, cnpj in rows:
        digits = only_digits(cnpj)
        if digits:
            out[digits] = company_id
    return out


def upsert_mirror(
    db: Session,
    org_id,
    certificates: Iterable[dict[str, Any]],
) -> SyncResult:
    cert_list = list(certificates)
    cnpj_map = build_company_cnpj_map(db, org_id)

    inserted = updated = mapped = unmapped = 0

    for cert in cert_list:
        sha1 = (cert.get("sha1_fingerprint") or cert.get("sha1") or "").strip() or None
        cert_id = (cert.get("cert_id") or cert.get("id") or "").strip() or None

        doc_type = (cert.get("document_type") or "").strip() or None
        doc_masked = (cert.get("document_masked") or cert.get("document") or "").strip() or None
        doc_unmasked = (cert.get("document_unmasked") or "").strip() or None
        # Para matching, sempre preferir unmasked (masked pode conter asteriscos).
        doc_digits = only_digits(doc_unmasked or doc_masked)

        # Matching company: apenas CNPJ (14 digitos).
        company_id = None
        if doc_type and doc_type.upper() == "CNPJ" and doc_digits and len(doc_digits) == 14:
            company_id = cnpj_map.get(doc_digits)
            if company_id:
                mapped += 1
            else:
                unmapped += 1

        # Localizar existente (prefer sha1).
        query = db.query(CertificateMirror).filter(CertificateMirror.org_id == org_id)
        existing = None
        if sha1:
            existing = query.filter(CertificateMirror.sha1_fingerprint == sha1).one_or_none()
        elif cert_id:
            existing = query.filter(CertificateMirror.cert_id == cert_id).one_or_none()

        # Raw deve ser JSON-serializavel (JSON/JSONB nao aceita datetime direto).
        raw_in = cert.get("raw")
        if isinstance(raw_in, dict):
            payload = _json_safe(raw_in)
        else:
            payload = _json_safe(dict(cert))
        parse_ok = bool(cert.get("parse_ok", True))
        not_before = parse_dt(cert.get("not_before"))
        not_after = parse_dt(cert.get("not_after"))
        last_ingested_at = parse_dt(cert.get("last_ingested_at"))

        if existing:
            existing.company_id = company_id
            existing.cert_id = cert_id
            existing.sha1_fingerprint = sha1
            existing.serial_number = cert.get("serial_number")
            existing.name = cert.get("name")
            existing.cn = cert.get("cn")
            existing.issuer_cn = cert.get("issuer_cn")
            existing.document_type = doc_type
            existing.document_digits = doc_digits
            existing.document_masked = doc_masked
            existing.parse_ok = parse_ok
            existing.not_before = not_before
            existing.not_after = not_after
            existing.last_ingested_at = last_ingested_at
            existing.raw = payload
            updated += 1
        else:
            db.add(
                CertificateMirror(
                    org_id=org_id,
                    company_id=company_id,
                    cert_id=cert_id,
                    sha1_fingerprint=sha1,
                    serial_number=cert.get("serial_number"),
                    name=cert.get("name"),
                    cn=cert.get("cn"),
                    issuer_cn=cert.get("issuer_cn"),
                    document_type=doc_type,
                    document_digits=doc_digits,
                    document_masked=doc_masked,
                    parse_ok=parse_ok,
                    not_before=not_before,
                    not_after=not_after,
                    last_ingested_at=last_ingested_at,
                    raw=payload,
                )
            )
            inserted += 1

    db.flush()

    updated_profiles = 0
    if os.getenv("CERT_MIRROR_UPDATE_COMPANY_PROFILES", "true").lower() in ("1", "true", "yes", "y"):
        updated_profiles = refresh_company_profiles_certificado_digital(db, org_id)

    return SyncResult(
        received=len(cert_list),
        inserted=inserted,
        updated=updated,
        mapped_companies=mapped,
        unmapped_cnpjs=unmapped,
        updated_company_profiles=updated_profiles,
    )


def refresh_company_profiles_certificado_digital(db: Session, org_id) -> int:
    """
    Atualiza company_profiles.certificado_digital = SIM/NÃO com base em certificados ativos mapeados.
    (Ativo = parse_ok && not_after >= hoje)
    """
    now = datetime.now(timezone.utc)

    active_company_ids = {
        row[0]
        for row in (
            db.query(CertificateMirror.company_id)
            .filter(
                CertificateMirror.org_id == org_id,
                CertificateMirror.company_id.isnot(None),
                CertificateMirror.parse_ok.is_(True),
                CertificateMirror.not_after.isnot(None),
                CertificateMirror.not_after >= now,
            )
            .distinct()
            .all()
        )
    }

    # Perfis pertencentes ao org via join com companies.
    profiles = (
        db.query(CompanyProfile)
        .join(Company, CompanyProfile.company_id == Company.id)
        .filter(Company.org_id == org_id)
        .all()
    )

    changed = 0
    for profile in profiles:
        desired = "SIM" if profile.company_id in active_company_ids else "NÃO"
        if (profile.certificado_digital or "").strip().upper() != desired:
            profile.certificado_digital = desired
            changed += 1

    db.flush()
    return changed


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def ingest_certificates_from_payload(
    db: AsyncSession, org: Organization, certificates: list[dict]
) -> dict:
    """
    Faz upsert dos certificados recebidos e retorna resumo util para webhook.
    """
    result = upsert_mirror(db, org.id, certificates)
    await _maybe_await(db.commit())
    return {
        "received": result.received,
        "inserted": result.inserted,
        "updated": result.updated,
        "upserted": result.inserted + result.updated,
        "mapped_companies": result.mapped_companies,
        "unmapped_cnpjs": result.unmapped_cnpjs,
        "updated_company_profiles": result.updated_company_profiles,
    }


async def delete_certificates_by_cert_ids(
    db: AsyncSession, org: Organization, cert_ids: list[str]
) -> dict:
    """Remove entradas do mirror por cert_id."""
    normalized_ids = sorted({(value or "").strip() for value in cert_ids if (value or "").strip()})
    if not normalized_ids:
        return {"deleted": 0}

    stmt = delete(CertificateMirror).where(
        CertificateMirror.org_id == org.id,
        CertificateMirror.cert_id.in_(normalized_ids),
    )
    result = await _maybe_await(db.execute(stmt))
    await _maybe_await(db.commit())
    deleted = int(result.rowcount or 0)
    return {"deleted": deleted}


async def reconcile_full(
    db: AsyncSession, org: Organization, certificates: list[dict]
) -> dict:
    """
    1. Faz upsert de todos os certs recebidos (chama ingest_certificates_from_payload)
    2. Deleta da tabela os registros da org cujo sha1_fingerprint
       NÃO esteja no payload recebido
    Retorna {"upserted": N, "deleted": M}
    """
    if not certificates:
        logger.warning("reconcile_full ignorado: payload vazio para org_id=%s", org.id)
        return {"upserted": 0, "deleted": 0, "skipped": True}

    ingest_result = await ingest_certificates_from_payload(db, org, certificates)
    fingerprints = sorted(
        {
            (cert.get("sha1_fingerprint") or cert.get("sha1") or "").strip()
            for cert in (certificates or [])
            if isinstance(cert, dict)
            and (cert.get("sha1_fingerprint") or cert.get("sha1") or "").strip()
        }
    )

    delete_stmt = delete(CertificateMirror).where(CertificateMirror.org_id == org.id)
    if fingerprints:
        delete_stmt = delete_stmt.where(
            (CertificateMirror.sha1_fingerprint.is_(None))
            | (~CertificateMirror.sha1_fingerprint.in_(fingerprints))
        )

    delete_result = await _maybe_await(db.execute(delete_stmt))
    await _maybe_await(db.commit())
    deleted = int(delete_result.rowcount or 0)
    return {"upserted": int(ingest_result.get("upserted", 0)), "deleted": deleted}
