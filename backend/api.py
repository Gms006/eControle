"""
api.py - FastAPI backend para eControle
Ajustes aplicados:
- Lê EXCEL_PATH, CORS_ORIGINS, API_HOST, API_PORT do ambiente (.env)
- Usa nomes de abas a partir do config.yaml (repo.config['sheet_names'])
- Endpoint /api/diagnostico para inspecionar mapeamentos de colunas
"""
from __future__ import annotations

import os
import logging
from datetime import datetime
from typing import List, Optional, Dict

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from repo_excel import ExcelRepo
from models import Empresa, Licenca, Taxa, Processo, LicencaRaw, TaxaRaw
from services import (
    filtrar_empresas, filtrar_processos,
    normalizar_licencas, normalizar_taxas,
    contar_licencas_por_status, contar_taxas_pendentes,
    contar_processos_empresa, calcular_kpis_globais,
)

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")


# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

EXCEL_PATH = os.getenv("EXCEL_PATH", "data/arquivo.xlsm")
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",") if o.strip()]
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

repo = ExcelRepo(EXCEL_PATH)

app = FastAPI(title="eControle API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache em memória (simples)
cache: Dict[str, object] = {
    "empresas": [],
    "licencas": [],
    "taxas": [],
    "processos": [],
    "last_update": None,
}


# ----------------------------------------------------------------------------
# Models p/ resposta (Pydantic)
# ----------------------------------------------------------------------------
class EmpresaResponse(BaseModel):
    id: int
    empresa: str
    cnpj: str
    municipio: str
    situacao: str
    categoria: str
    debito: str
    certificado: str
    inscricao_estadual: str
    inscricao_municipal: str
    email: str
    telefone: str
    updated_at: str

    class Config:
        from_attributes = True


class LicencaResponse(BaseModel):
    empresa: str
    tipo: str
    status: str
    validade: Optional[str]
    obs: str


class TaxaResponse(BaseModel):
    empresa: str
    tpi: str
    func: str
    publicidade: str
    sanitaria: str


class ProcessoResponse(BaseModel):
    empresa: str
    tipo: str
    codigo: str
    inicio: str
    prazo: Optional[str]
    status: str


class KPIsResponse(BaseModel):
    total_empresas: int
    sem_certificado: int
    licencas_vencidas: int
    tpi_pendente: int


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------


def _to_str(value, default: str = "") -> str:
    """Return a sanitized string value with fallback."""
    if value is None:
        return default

    text = str(value).strip()
    return text if text else default


def _sheet_name(key: str, default: str) -> str:
    return repo.config.get("sheet_names", {}).get(key, default)


def carregar_dados_do_excel() -> None:
    """Carrega dados do Excel e atualiza cache"""
    try:
        repo.open()

        # Nomes das abas (do config.yaml)
        emp_sheet = _sheet_name("empresas", "EMPRESAS")
        lic_sheet = _sheet_name("licencas", "LICENÇAS")
        tax_sheet = _sheet_name("taxas", "TAXAS")
        proc_div_sheet = _sheet_name("processos_diversos", "Diversos")

        # Empresas
        empresas_raw = repo.read_sheet(emp_sheet, "empresas")
        empresas = [
            Empresa(
                id=int(r.get("ID", 0)),
                empresa=r.get("EMPRESA", ""),
                cnpj=r.get("CNPJ", ""),
                porte=r.get("PORTE", ""),
                municipio=r.get("MUNICIPIO", ""),
                status_empresas=r.get("STATUS_EMPRESAS", "Ativa"),
                categoria=r.get("CATEGORIA", ""),
                ie=_to_str(r.get("IE"), "–"),
                im=_to_str(r.get("IM"), "Não Possui"),
                situacao=r.get("SITUACAO", "em dia"),
                debito=r.get("DEBITO", "Não"),
                certificado=r.get("CERTIFICADO", "NÃO"),
                obs=r.get("OBS", ""),
                telefone=r.get("TELEFONE", ""),
                email=r.get("EMAIL", ""),
                updated_at=r.get("UPDATED_AT", datetime.now().isoformat()[:10]),
            )
            for r in empresas_raw
            if r.get("ID")
        ]

        # Licenças (larga -> longa)
        licencas_raw_data = repo.read_sheet(lic_sheet, "licencas")
        licencas_raw_objs = [
            LicencaRaw(
                id=int(r.get("ID", 0)),
                empresa=r.get("EMPRESA", ""),
                cnpj=r.get("CNPJ", ""),
                municipio=r.get("MUNICIPIO", ""),
                sanitaria=r.get("SANITARIA", "*"),
                cercon=r.get("CERCON", "*"),
                funcionamento=r.get("FUNCIONAMENTO", "*"),
                ambiental=r.get("AMBIENTAL", "*"),
                uso_solo=r.get("USO_SOLO", "*"),
            )
            for r in licencas_raw_data
            if r.get("ID")
        ]
        licencas = normalizar_licencas(licencas_raw_objs)

        # Taxas (larga -> longa)
        taxas_raw_data = repo.read_sheet(tax_sheet, "taxas")
        taxas_raw_objs = [
            TaxaRaw(
                id=int(r.get("ID", 0)),
                empresa=r.get("EMPRESA", ""),
                cnpj=r.get("CNPJ", ""),
                data_envio=str(r.get("DATA_ENVIO", "")),
                funcionamento=r.get("FUNCIONAMENTO", "*"),
                publicidade=r.get("PUBLICIDADE", "*"),
                sanitaria=r.get("SANITARIA", "*"),
                localizacao=r.get("LOCALIZACAO", "*"),
                ocupacao=r.get("OCUPACAO", "*"),
                bombeiros=r.get("BOMBEIROS", "*"),
                tpi=r.get("TPI", "*"),
                status_taxas=r.get("STATUS_TAXAS", ""),
            )
            for r in taxas_raw_data
            if r.get("ID")
        ]
        taxas = normalizar_taxas(taxas_raw_objs)

        # Processos (exemplo: aba Diversos)
        processos_raw = repo.read_sheet(proc_div_sheet, "processos")
        processos = [
            Processo(
                id=int(r.get("ID", 0)),
                empresa=r.get("EMPRESA", ""),
                cnpj=r.get("CNPJ", ""),
                tipo="Diversos",
                protocolo=r.get("PROTOCOLO", ""),
                data_solicitacao=r.get("DATA_SOLICITACAO", ""),
                situacao=r.get("SITUACAO", ""),
                obs=r.get("OBS", ""),
                prazo=r.get("PRAZO"),
            )
            for r in processos_raw
            if r.get("EMPRESA")
        ]

        cache.update(
            {
                "empresas": empresas,
                "licencas": licencas,
                "taxas": taxas,
                "processos": processos,
                "last_update": datetime.now().isoformat(),
            }
        )
        logger.info(
            "Dados carregados: %s empresas, %s licenças, %s taxas, %s processos",
            len(empresas),
            len(licencas),
            len(taxas),
            len(processos),
        )
    except Exception as e:
        logger.exception("Erro ao carregar dados")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        repo.close()


# ----------------------------------------------------------------------------
# Eventos
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    carregar_dados_do_excel()


# ----------------------------------------------------------------------------
# Rotas
# ----------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "eControle API",
        "version": app.version,
        "last_update": cache.get("last_update"),
    }


@app.get("/api/empresas", response_model=List[EmpresaResponse])
def get_empresas(
    query: Optional[str] = None,
    municipio: Optional[str] = None,
    so_alertas: bool = False,
):
    empresas = filtrar_empresas(
        cache["empresas"], query=query, municipio=municipio, so_alertas=so_alertas
    )
    return [
        EmpresaResponse(
            id=e.id,
            empresa=e.empresa,
            cnpj=e.cnpj,
            municipio=e.municipio,
            situacao=e.status_empresas,
            categoria=e.categoria,
            debito=e.debito,
            certificado=e.certificado,
            inscricao_estadual=_to_str(e.ie),
            inscricao_municipal=_to_str(e.im),
            email=e.email,
            telefone=e.telefone,
            updated_at=e.updated_at or "",
        )
        for e in empresas
    ]


@app.get("/api/empresas/{empresa_id}")
def get_empresa(empresa_id: int):
    empresa = next((e for e in cache["empresas"] if e.id == empresa_id), None)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    licencas_stats = contar_licencas_por_status(cache["licencas"], empresa.empresa)
    taxas_pend = contar_taxas_pendentes(cache["taxas"], empresa.empresa)
    processos_count = contar_processos_empresa(cache["processos"], empresa.empresa)

    return {
        "empresa": EmpresaResponse.from_orm(empresa),
        "licencas_ativas": licencas_stats["ativas"],
        "licencas_vencendo": licencas_stats["vencendo"],
        "processos": processos_count,
        "taxas_pendentes": taxas_pend,
    }


@app.get("/api/licencas")
def get_licencas(empresa: Optional[str] = None):
    licencas: List[Licenca] = cache["licencas"]
    if empresa:
        licencas = [l for l in licencas if l.empresa == empresa]

    result = []
    for lic in licencas:
        result.append(
            {
                "empresa": lic.empresa,
                "tipo": lic.tipo,
                "status": lic.status_display,
                "validade": lic.validade or "—",
                "obs": lic.obs,
            }
        )
    return result


@app.get("/api/taxas")
def get_taxas():
    taxas: List[Taxa] = cache["taxas"]

    # Agrupar por empresa → formato "largo" p/ UI
    result = []
    empresas_unicas = sorted(set(t.empresa for t in taxas))
    for emp in empresas_unicas:
        taxas_emp = {t.tipo: t.status_display for t in taxas if t.empresa == emp}
        result.append(
            {
                "empresa": emp,
                "tpi": taxas_emp.get("TPI", "*"),
                "func": taxas_emp.get("Funcionamento", "*"),
                "publicidade": taxas_emp.get("Publicidade", "*"),
                "sanitaria": taxas_emp.get("Sanitária", "*"),
            }
        )
    return result


@app.get("/api/processos")
def get_processos(tipo: Optional[str] = None, apenas_ativos: bool = False):
    processos = filtrar_processos(
        cache["processos"], tipo=tipo, apenas_ativos=apenas_ativos
    )
    return [
        {
            "empresa": p.empresa,
            "tipo": p.tipo,
            "codigo": p.protocolo,
            "inicio": p.data_solicitacao,
            "prazo": p.prazo,
            "status": p.situacao,
        }
        for p in processos
    ]


@app.get("/api/kpis", response_model=KPIsResponse)
def get_kpis():
    kpis = calcular_kpis_globais(
        cache["empresas"], cache["licencas"], cache["taxas"]
    )
    return KPIsResponse(**kpis)


@app.get("/api/municipios")
def get_municipios():
    municipios_normalizados = set()
    for empresa in cache["empresas"]:
        municipio = str(getattr(empresa, "municipio", "") or "").strip()
        if not municipio:
            continue
        municipios_normalizados.add(municipio.title())

    return sorted(municipios_normalizados)


@app.post("/api/refresh")
def refresh_data(background_tasks: BackgroundTasks):
    background_tasks.add_task(carregar_dados_do_excel)
    return {"message": "Recarregando dados"}


@app.get("/api/diagnostico")
def diagnostico():
    """Retorna mapeamento de colunas por aba + avisos."""
    out = {"maps": {}, "warnings": []}
    try:
        repo.open()
        sheets = {
            "empresas": _sheet_name("empresas", "EMPRESAS"),
            "licencas": _sheet_name("licencas", "LICENÇAS"),
            "taxas": _sheet_name("taxas", "TAXAS"),
        }
        required = {
            "empresas": ["ID", "EMPRESA", "CNPJ", "MUNICIPIO"],
            "licencas": ["ID", "EMPRESA", "CNPJ", "MUNICIPIO", "SANITARIA", "FUNCIONAMENTO"],
            "taxas": ["ID", "EMPRESA", "CNPJ", "TPI"],
        }
        for key, sheet_name in sheets.items():
            # força construção do mapa
            repo.build_column_map(sheet_name, key)
            colmap = repo.get_column_map(key)
            out["maps"][key] = colmap
            missing = [c for c in required[key] if c not in colmap]
            if missing:
                out["warnings"].append(
                    f"{sheet_name}: colunas ausentes {missing}"
                )
        return out
    finally:
        repo.close()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "empresas_count": len(cache["empresas"]),
        "last_update": cache.get("last_update"),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=API_HOST, port=API_PORT, reload=True)
