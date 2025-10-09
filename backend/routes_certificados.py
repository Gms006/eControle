from fastapi import APIRouter

from services.data_certificados import get_agendamentos, get_certificados

router = APIRouter()


@router.get("/certificados")
def api_certificados():
    return get_certificados()


@router.get("/agendamentos")
def api_agendamentos():
    return get_agendamentos()
