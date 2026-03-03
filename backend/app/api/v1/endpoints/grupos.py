from fastapi import APIRouter, Depends

from app.core.security import require_roles

router = APIRouter()


@router.get("/kpis")
def get_kpi_groups(_user=Depends(require_roles("ADMIN", "DEV", "VIEW"))):
    # Implementacao minima para remover 404 do frontend.
    # Estrutura de KPIs sera definida numa stage futura.
    return []
