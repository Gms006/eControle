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
    ok, info, path, url = await emitir_cnd_anapolis(cnpj)
    return {"ok": ok, "info": info, "path": path, "url": url}


@router.get("/cnds/{cnpj}/list")
async def cnds_list(cnpj: str):
    from pathlib import Path
    import os

    digits = only_digits(cnpj)
    base = Path(os.getenv("CND_DIR_BASE", "certidoes")) / digits
    if not digits or not base.exists():
        return []

    arquivos = sorted(
        base.glob("*.pdf"),
        key=lambda arquivo: arquivo.stat().st_mtime,
        reverse=True,
    )

    itens = []
    for arquivo in arquivos:
        stat = arquivo.stat()
        itens.append(
            {
                "name": arquivo.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "url": f"/cnds/{digits}/{arquivo.name}",
            }
        )

    return itens

