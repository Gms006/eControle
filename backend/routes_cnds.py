import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cnds_worker_anapolis import emitir_cnd_anapolis

router = APIRouter(tags=["cnds"])


class EmitirPedido(BaseModel):
    cidade: str = Field(..., description="Por enquanto, apenas 'anapolis'")
    cnpj: str


def only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


@router.post("/cnds/emitir")
async def cnds_emitir(ped: EmitirPedido):
    if ped.cidade.lower() != "anapolis":
        raise HTTPException(400, "Cidade não suportada nesta etapa.")
    cnpj = only_digits(ped.cnpj)
    if len(cnpj) != 14:
        raise HTTPException(400, "CNPJ inválido (14 dígitos).")
    ok, info, path = await emitir_cnd_anapolis(cnpj)
    return {"ok": ok, "info": info, "path": path}

