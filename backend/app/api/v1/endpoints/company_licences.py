import logging
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.normalization import normalize_municipio
from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company import Company
from app.models.org import Org
from app.models.company_licence import CompanyLicence
from app.models.licence_scan_run import LicenceScanRun
from app.models.user import User
from app.schemas.company_licence import (
    LicenceDetectItemOut,
    LicenceDetectResponse,
    CompanyLicenceItemUpdate,
    CompanyLicenceOut,
    LicenceUploadBulkResponse,
    LicenceUploadItemResult,
)
from app.services.licence_detection import parse_filename_to_suggestion
from app.services.licence_fs_paths import resolve_target_dir
from app.services.licence_files import (
    SUPPORTED_EXTENSIONS,
    format_standard_filename,
    is_safe_fs_dirname,
    parse_iso_date,
    resolve_licence_name_spec,
)
from app.services.licence_scan_full import run_licence_scan_full_job

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024
LICENCES_SUBDIR = Path("Societário") / "Alvarás e Certidões"


def _resolve_company_name(company: Company | None, company_id: str) -> tuple[str, bool]:
    if company and company.razao_social:
        return company.razao_social, False
    return f"Empresa não vinculada (ID {company_id})", True


def _to_company_licence_out(licence: CompanyLicence, company: Company | None) -> CompanyLicenceOut:
    company_name, sem_vinculo = _resolve_company_name(company, licence.company_id)
    if sem_vinculo:
        logger.warning(
            "company_licence_sem_vinculo org_id=%s licence_id=%s company_id=%s",
            licence.org_id,
            licence.id,
            licence.company_id,
        )

    payload = {
        **CompanyLicenceOut.model_validate(licence).model_dump(),
        "company_name": company_name,
        "company_cnpj": getattr(company, "cnpj", None),
        "company_razao_social": getattr(company, "razao_social", None),
        "company_municipio": getattr(company, "municipio", None) or licence.municipio,
        "sem_vinculo": sem_vinculo,
    }
    return CompanyLicenceOut.model_validate(payload)


@router.get("", response_model=list[CompanyLicenceOut])
def list_company_licences(
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
    limit: int = Query(default=1000, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[CompanyLicenceOut]:
    rows = (
        db.query(CompanyLicence, Company)
        .outerjoin(
            Company,
            (Company.id == CompanyLicence.company_id) & (Company.org_id == CompanyLicence.org_id),
        )
        .filter(CompanyLicence.org_id == org.id)
        .order_by(CompanyLicence.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_company_licence_out(licence, company) for licence, company in rows]


@router.patch("/{licence_id}/item", response_model=CompanyLicenceOut)
def patch_company_licence_item(
    licence_id: str,
    payload: CompanyLicenceItemUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyLicenceOut:
    licence = (
        db.query(CompanyLicence)
        .filter(CompanyLicence.id == licence_id, CompanyLicence.org_id == org.id)
        .first()
    )
    if not licence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Licence not found")

    setattr(licence, payload.field, payload.status)
    setattr(licence, f"{payload.field}_valid_until", parse_iso_date(payload.validade) if payload.validade else None)

    raw = licence.raw if isinstance(licence.raw, dict) else {}
    if payload.validade:
        raw[f"validade_{payload.field}"] = payload.validade
    if payload.observacao is not None:
        raw[f"{payload.field}_observacao"] = payload.observacao
    if payload.responsavel is not None:
        raw[f"{payload.field}_responsavel"] = payload.responsavel
    if payload.proxima_acao is not None:
        raw[f"{payload.field}_proxima_acao"] = payload.proxima_acao

    if payload.status == "nao_exigido":
        licence.motivo_nao_exigido = payload.motivo_nao_exigido
        licence.justificativa_nao_exigido = payload.justificativa_nao_exigido
        raw[f"{payload.field}_motivo_nao_exigido"] = payload.motivo_nao_exigido
        raw[f"{payload.field}_justificativa_nao_exigido"] = payload.justificativa_nao_exigido
    else:
        licence.motivo_nao_exigido = None
        licence.justificativa_nao_exigido = None
        if raw.get(f"{payload.field}_motivo_nao_exigido"):
            raw[f"{payload.field}_motivo_nao_exigido"] = None
        if raw.get(f"{payload.field}_justificativa_nao_exigido"):
            raw[f"{payload.field}_justificativa_nao_exigido"] = None

    if payload.validade:
        year, month, day = payload.validade.split("-")
        raw[f"validade_{payload.field}_br"] = f"{day}/{month}/{year}"

    licence.municipio = normalize_municipio(licence.municipio)
    licence.raw = raw

    db.commit()
    db.refresh(licence)

    company = (
        db.query(Company)
        .filter(Company.id == licence.company_id, Company.org_id == org.id)
        .first()
    )
    return _to_company_licence_out(licence, company)


@router.post("/scan-full")
def run_scan_full(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    user: User = Depends(require_roles("ADMIN", "DEV")),
) -> dict[str, str]:
    run = LicenceScanRun(
        org_id=org.id,
        status="queued",
        total=0,
        processed=0,
        ok_count=0,
        error_count=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    logger.info("licence_scan_full_started run_id=%s org_id=%s user_id=%s", run.id, org.id, user.id)
    background_tasks.add_task(run_licence_scan_full_job, run.id)
    return {"run_id": run.id, "status": run.status}


@router.post("/detect", response_model=LicenceDetectResponse)
async def detect_company_licences(
    items: list[UploadFile] = File(...),
    _org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> LicenceDetectResponse:
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    results: list[LicenceDetectItemOut] = []
    for upload in items:
        suggestion = parse_filename_to_suggestion(upload.filename or "")
        results.append(
            LicenceDetectItemOut(
                original_filename=suggestion.original_filename,
                suggested_group=suggestion.suggested_group,
                suggested_document_kind=suggestion.suggested_document_kind,
                suggested_expires_at=(
                    suggestion.suggested_expires_at.isoformat() if suggestion.suggested_expires_at else None
                ),
                is_definitive=suggestion.is_definitive,
                confidence=suggestion.confidence,
                evidence_snippets=suggestion.evidence_snippets,
                canonical_filename=suggestion.canonical_filename,
                warnings=suggestion.warnings,
            )
        )
        await upload.close()

    return LicenceDetectResponse(results=results)


@router.post("/upload-bulk", response_model=LicenceUploadBulkResponse)
async def upload_company_licences_bulk(
    company_id: str = Form(...),
    items: list[UploadFile] = File(...),
    licence_type: list[str] = Form(...),
    expires_at: list[str] = Form(...),
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> LicenceUploadBulkResponse:
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    if len(items) != len(licence_type) or len(items) != len(expires_at):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Each item must include file, licence_type and expires_at",
        )

    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.org_id == org.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    if not is_safe_fs_dirname(company.fs_dirname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company fs_dirname is missing or invalid",
        )

    root_dir = Path(settings.EMPRESAS_ROOT_DIR).resolve()
    base_dir = (root_dir / str(company.fs_dirname) / LICENCES_SUBDIR).resolve()
    try:
        base_dir.relative_to(root_dir)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target path")

    base_dir.mkdir(parents=True, exist_ok=True)
    resolution = resolve_target_dir(base_dir, municipio=company.municipio, cnpj=company.cnpj)
    if resolution.target_dir is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{resolution.warning} Configure a pasta da unidade (Matriz/Filial) antes do upload.",
        )
    target_dir = resolution.target_dir

    results: list[LicenceUploadItemResult] = []
    saved_count = 0
    for index, upload in enumerate(items):
        original_name = upload.filename or f"item-{index + 1}"
        try:
            file_extension = (Path(original_name).suffix or "").lower().strip(".")
            if file_extension not in SUPPORTED_EXTENSIONS:
                raise ValueError("Unsupported extension. Use pdf, jpg or png")

            name_spec = resolve_licence_name_spec(licence_type[index])
            if not name_spec:
                raise ValueError("Invalid licence_type")

            expiry_date = parse_iso_date(expires_at[index])
            if name_spec.requires_expiry and not expiry_date:
                raise ValueError("Invalid expires_at. Use YYYY-MM-DD")

            content = await upload.read()
            if len(content) == 0:
                raise ValueError("Empty file")
            if len(content) > MAX_UPLOAD_SIZE_BYTES:
                raise ValueError("File too large")

            final_name = format_standard_filename(name_spec, expiry_date, file_extension)
            final_path = (target_dir / final_name).resolve()
            try:
                final_path.relative_to(target_dir)
            except ValueError:
                raise ValueError("Invalid final path")

            temp_path = final_path.with_suffix(f"{final_path.suffix}.tmp")
            with open(temp_path, "wb") as temp_file:
                temp_file.write(content)
                temp_file.flush()
                os.fsync(temp_file.fileno())
            os.replace(temp_path, final_path)

            relative_path = str(final_path.relative_to(root_dir)).replace("\\", "/")
            results.append(
                LicenceUploadItemResult(
                    file_original=original_name,
                    ok=True,
                    final_name=final_name,
                    relative_path=relative_path,
                )
            )
            saved_count += 1
        except Exception as exc:
            results.append(
                LicenceUploadItemResult(
                    file_original=original_name,
                    ok=False,
                    error=str(exc),
                )
            )
        finally:
            await upload.close()

    return LicenceUploadBulkResponse(
        company_id=company.id,
        saved_count=saved_count,
        results=results,
    )
