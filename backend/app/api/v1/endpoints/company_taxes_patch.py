from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.org_context import get_current_org
from app.core.security import require_roles
from app.db.session import get_db
from app.models.company_tax import CompanyTax
from app.models.org import Org
from app.schemas.company_tax import CompanyTaxOut, CompanyTaxUpdate


router = APIRouter()


def _is_em_aberto(value: str | None) -> bool:
    text = str(value or "").strip().lower().replace(" ", "_")
    return text == "em_aberto"


@router.patch("/{tax_id}", response_model=CompanyTaxOut)
def patch_company_tax(
    tax_id: str,
    payload: CompanyTaxUpdate,
    db: Session = Depends(get_db),
    org: Org = Depends(get_current_org),
    _user=Depends(require_roles("ADMIN", "DEV")),
) -> CompanyTaxOut:
    tax = (
        db.query(CompanyTax)
        .filter(CompanyTax.id == tax_id, CompanyTax.org_id == org.id)
        .first()
    )
    if not tax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(tax, key, value)

    tracked_fields = [
        tax.taxa_funcionamento,
        tax.taxa_publicidade,
        tax.taxa_vig_sanitaria,
        tax.iss,
        tax.taxa_localiz_instalacao,
        tax.taxa_ocup_area_publica,
        tax.taxa_bombeiros,
        tax.tpi,
    ]
    tax.status_taxas = "irregular" if any(_is_em_aberto(value) for value in tracked_fields) else "regular"

    db.commit()
    db.refresh(tax)
    return CompanyTaxOut.model_validate(tax)
