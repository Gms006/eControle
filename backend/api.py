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
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from repo_excel import ExcelRepo
from models import (
    Empresa,
    Licenca,
    Taxa,
    Processo,
    Contato,
    Modelo,
    LicencaRaw,
    TaxaRaw,
)
from services import (
    filtrar_empresas, filtrar_processos,
    normalizar_licencas, normalizar_taxas,
    contar_licencas_por_status, contar_taxas_pendentes,
    contar_processos_empresa, calcular_kpis_globais,
)
from routes_certificados import router as certificados_router
from routes_cnds import router as cnds_router

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / ".env")


# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

EXCEL_PATH = os.getenv("EXCEL_PATH", "data/arquivo.xlsm")
CONFIG_PATH = os.getenv(
    "CONFIG_PATH", str(Path(__file__).parent / "config.yaml")
)
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",") if o.strip()]
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

repo = ExcelRepo(EXCEL_PATH, config_path=CONFIG_PATH)

app = FastAPI(title="eControle API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(certificados_router, prefix="/api")
app.include_router(cnds_router, prefix="/api")

# Cache em memória (simples)
cache: Dict[str, object] = {
    "empresas": [],
    "licencas": [],
    "taxas": [],
    "processos": [],
    "contatos": [],
    "modelos": [],
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
    empresa_id: int
    empresa: str
    tipo: str
    status: str
    validade: Optional[str]
    obs: str


class TaxaResponse(BaseModel):
    empresa_id: int
    empresa: str
    tpi: str
    func: str
    publicidade: str
    sanitaria: str
    localizacao_instalacao: str
    area_publica: str
    bombeiros: str
    status_geral: Optional[str]


class ProcessoResponse(BaseModel):
    empresa_id: int
    empresa: str
    tipo: str
    codigo: str
    inicio: str
    prazo: Optional[str]
    status: str


class ContatoResponse(BaseModel):
    contato: str
    municipio: str
    telefone: str
    whatsapp: str
    email: str
    categoria: str

    class Config:
        from_attributes = True


class ModeloResponse(BaseModel):
    descricao: str
    utilizacao: str
    modelo: str

    class Config:
        from_attributes = True


class UteisResponse(BaseModel):
    contatos: List[ContatoResponse]
    modelos: List[ModeloResponse]


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


def _to_int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        if isinstance(value, float):
            return int(value)
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _format_excel_date(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, (int, float)):
        try:
            base = datetime(1899, 12, 30)
            converted = base + timedelta(days=float(value))
            return converted.strftime("%d/%m/%Y")
        except (OverflowError, ValueError):
            return None
    text = _to_str(value)
    return text or None


PROCESSO_TIPOS = {
    "diversos": "Diversos",
    "funcionamento": "Funcionamento",
    "bombeiros": "Bombeiros",
    "uso_solo": "Uso do Solo",
    "sanitario": "Alvará Sanitário",
    "ambiental": "Licença Ambiental",
}


TAXA_TIPOS_OUTPUT = [
    ("TPI", "tpi"),
    ("Funcionamento", "func"),
    ("Publicidade", "publicidade"),
    ("Sanitária", "sanitaria"),
    ("Localização/Instalação", "localizacao_instalacao"),
    ("Área Pública", "area_publica"),
    ("Bombeiros", "bombeiros"),
    ("Status Geral", "status_geral"),
]


def _processo_tipo_label(proc_key: str) -> str:
    return PROCESSO_TIPOS.get(proc_key, proc_key.replace("_", " ").title())


def _rows_to_processos(proc_key: str, rows: List[Dict[str, Any]]) -> List[Processo]:
    processos: List[Processo] = []
    tipo_label = _processo_tipo_label(proc_key)

    for row in rows:
        empresa_id = _to_int(row.get("ID"))
        empresa = _to_str(row.get("EMPRESA"))
        protocolo = _to_str(row.get("PROTOCOLO"))
        if not empresa_id:
            continue
        if not empresa and not protocolo:
            continue

        processo = Processo(
            empresa_id=empresa_id,
            empresa=empresa,
            cnpj=_to_str(row.get("CNPJ")),
            tipo=tipo_label,
            protocolo=protocolo,
            data_solicitacao=_format_excel_date(row.get("DATA_SOLICITACAO")) or _to_str(row.get("DATA_SOLICITACAO")),
            situacao=_to_str(row.get("SITUACAO")),
            status_padrao=_to_str(row.get("STATUS_PADRAO")),
            obs=_to_str(row.get("OBS")),
            prazo=_format_excel_date(row.get("PRAZO")) or _to_str(row.get("PRAZO")),
        )

        if proc_key == "diversos":
            operacao = _to_str(row.get("OPERACAO"))
            if operacao:
                processo.tipo = f"{processo.tipo} - {operacao}"
            processo.operacao = operacao
            processo.orgao = _to_str(row.get("ORGAO"))
        elif proc_key == "funcionamento":
            processo.alvara = _to_str(row.get("ALVARA"))
            processo.municipio = _to_str(row.get("MUNICIPIO"))
        elif proc_key == "bombeiros":
            processo.tpi = _to_str(row.get("TPI"))
        elif proc_key == "uso_solo":
            processo.inscricao_imobiliaria = _to_str(row.get("INSCRICAO_IMOBILIARIA"))
        elif proc_key == "sanitario":
            processo.servico = _to_str(row.get("SERVICO"))
            processo.taxa = _to_str(row.get("TAXA"))
            processo.notificacao = _to_str(row.get("NOTIFICACAO"))
            processo.data_val = _format_excel_date(row.get("DATA_VAL")) or _to_str(row.get("DATA_VAL"))

        processos.append(processo)

    return processos


def carregar_dados_do_excel() -> None:
    """Carrega dados do Excel e atualiza cache"""
    try:
        repo.open()

        # Nomes das abas (do config.yaml)
        sheet_cfg = repo.config.get("sheet_names", {})
        table_cfg = repo.config.get("table_names", {})

        emp_sheet = sheet_cfg.get("empresas", "EMPRESAS")
        lic_sheet = sheet_cfg.get("licencas", "LICENÇAS")
        tax_sheet = sheet_cfg.get("taxas", "TAXAS")
        proc_sheet = sheet_cfg.get("processos", "PROCESSOS")
        uteis_sheet = sheet_cfg.get("uteis", "CONTATOS E MODELOS")

        # Empresas
        empresas_raw = repo.read_sheet(emp_sheet, "empresas")
        empresas = [
            Empresa(
                id=_to_int(r.get("ID")),
                empresa=_to_str(r.get("EMPRESA")),
                cnpj=_to_str(r.get("CNPJ")),
                porte=_to_str(r.get("PORTE")),
                municipio=_to_str(r.get("MUNICIPIO")),
                status_empresas=_to_str(r.get("SITUACAO"), "Ativa"),
                categoria=_to_str(r.get("CATEGORIA")),
                ie=_to_str(r.get("IE"), "–"),
                im=_to_str(r.get("IM"), "Não Possui"),
                situacao=_to_str(r.get("SITUACAO"), "em dia"),
                debito=_to_str(r.get("DEBITO_PREFEITURA"), "Não"),
                certificado=_to_str(r.get("CERTIFICADO_DIGITAL"), "NÃO"),
                obs=_to_str(r.get("OBS")),
                proprietario=_to_str(r.get("PROPRIETARIO_PRINCIPAL")),
                cpf=_to_str(r.get("CPF")),
                telefone=_to_str(r.get("TELEFONE")),
                email=_to_str(r.get("E_MAIL")),
                responsavel=_to_str(r.get("RESPONSAVEL_FISCAL")),
                updated_at=_to_str(r.get("UPDATED_AT"), datetime.now().isoformat()[:10]),
            )
            for r in empresas_raw
            if _to_int(r.get("ID")) and _to_str(r.get("EMPRESA"))
        ]

        # Licenças (larga -> longa)
        licencas_raw_data = repo.read_sheet(lic_sheet, "licencas")
        licencas_raw_objs = [
            LicencaRaw(
                empresa_id=_to_int(r.get("ID")),
                empresa=_to_str(r.get("EMPRESA")),
                cnpj=_to_str(r.get("CNPJ")),
                municipio=_to_str(r.get("MUNICIPIO")),
                sanitaria_status=_to_str(r.get("SANITARIA_STATUS"), "*"),
                sanitaria_val=_format_excel_date(r.get("SANITARIA_VAL")),
                cercon_status=_to_str(r.get("CERCON_STATUS"), "*"),
                cercon_val=_format_excel_date(r.get("CERCON_VAL")),
                funcionamento_status=_to_str(r.get("FUNCIONAMENTO_STATUS"), "*"),
                funcionamento_val=_format_excel_date(r.get("FUNCIONAMENTO_VAL")),
                ambiental_status=_to_str(r.get("AMBIENTAL_STATUS"), "*"),
                ambiental_val=_format_excel_date(r.get("AMBIENTAL_VAL")),
                uso_solo_status=_to_str(r.get("USO_SOLO_STATUS"), "*"),
                uso_solo_val=_format_excel_date(r.get("USO_SOLO_VAL")),
                obs=_to_str(r.get("OBS")),
            )
            for r in licencas_raw_data
            if _to_int(r.get("ID")) and _to_str(r.get("EMPRESA"))
        ]
        licencas = normalizar_licencas(licencas_raw_objs)

        # Taxas (larga -> longa)
        taxas_raw_data = repo.read_sheet(tax_sheet, "taxas")
        taxas_raw_objs = [
            TaxaRaw(
                empresa_id=_to_int(r.get("ID")),
                empresa=_to_str(r.get("EMPRESA")),
                cnpj=_to_str(r.get("CNPJ")),
                data_envio=_format_excel_date(r.get("DATA_ENVIO")) or _to_str(r.get("DATA_ENVIO")),
                funcionamento=_to_str(r.get("FUNCIONAMENTO"), "*"),
                publicidade=_to_str(r.get("PUBLICIDADE"), "*"),
                sanitaria=_to_str(r.get("SANITARIA"), "*"),
                localizacao_instalacao=(
                    _to_str(r.get("LOCALIZACAO_INSTALACAO"), "")
                    or _to_str(r.get("LOCALIZACAO"), "*")
                ),
                area_publica=(
                    _to_str(r.get("AREA_PUBLICA"), "")
                    or _to_str(r.get("OCUPACAO"), "*")
                ),
                localizacao=_to_str(r.get("LOCALIZACAO"), "*"),
                ocupacao=_to_str(r.get("OCUPACAO"), "*"),
                bombeiros=_to_str(r.get("BOMBEIROS"), "*"),
                tpi=_to_str(r.get("TPI"), "*"),
                status_taxas=_to_str(r.get("STATUS_TAXAS")),
                obs=_to_str(r.get("OBS")),
            )
            for r in taxas_raw_data
            if _to_int(r.get("ID")) and _to_str(r.get("EMPRESA"))
        ]
        taxas = normalizar_taxas(taxas_raw_objs)

        processos: List[Processo] = []
        processos_tables = table_cfg.get("processos", {})
        for proc_key, table_name in processos_tables.items():
            sheet_key = f"processos_{proc_key}"
            rows = repo.read_table(proc_sheet, table_name, sheet_key)
            if rows:
                processos.extend(_rows_to_processos(proc_key, rows))

        contatos: List[Contato] = []
        modelos: List[Modelo] = []
        uteis_tables = table_cfg.get("uteis", {})

        contatos_table = uteis_tables.get("contatos")
        if contatos_table:
            contato_rows = repo.read_table(uteis_sheet, contatos_table, "uteis_contatos")
            for row in contato_rows:
                nome = _to_str(row.get("CONTATO"))
                if not nome:
                    continue
                contatos.append(
                    Contato(
                        contato=nome,
                        municipio=_to_str(row.get("MUNICIPIO")),
                        telefone=_to_str(row.get("TELEFONE")),
                        whatsapp=_to_str(row.get("WHATSAPP"), "NÃO"),
                        email=_to_str(row.get("E_MAIL")),
                        categoria=_to_str(row.get("CATEGORIA")),
                    )
                )

        modelos_table = uteis_tables.get("modelos")
        if modelos_table:
            modelo_rows = repo.read_table(uteis_sheet, modelos_table, "uteis_modelos")
            for row in modelo_rows:
                texto = _to_str(row.get("MODELO"))
                descricao = _to_str(row.get("DESCRICAO"))
                if not texto and not descricao:
                    continue
                modelos.append(
                    Modelo(
                        modelo=texto,
                        descricao=descricao or "Modelo",
                        utilizacao=_to_str(row.get("UTILIZACAO")) or "WhatsApp",
                    )
                )

        cache.update(
            {
                "empresas": empresas,
                "licencas": licencas,
                "taxas": taxas,
                "processos": processos,
                "contatos": contatos,
                "modelos": modelos,
                "last_update": datetime.now().isoformat(),
            }
        )
        logger.info(
            "Dados carregados: %s empresas, %s licenças, %s taxas, %s processos, %s contatos, %s modelos",
            len(empresas),
            len(licencas),
            len(taxas),
            len(processos),
            len(contatos),
            len(modelos),
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

    licencas_stats = contar_licencas_por_status(cache["licencas"], empresa.id)
    taxas_pend = contar_taxas_pendentes(cache["taxas"], empresa.id)
    processos_count = contar_processos_empresa(cache["processos"], empresa.id)

    return {
        "empresa": EmpresaResponse.from_orm(empresa),
        "licencas_ativas": licencas_stats["ativas"],
        "licencas_vencendo": licencas_stats["vencendo"],
        "processos": processos_count,
        "taxas_pendentes": taxas_pend,
    }


@app.get("/api/licencas")
def get_licencas(empresa_id: Optional[int] = None, empresa: Optional[str] = None):
    licencas: List[Licenca] = cache["licencas"]
    if empresa_id is not None:
        licencas = [l for l in licencas if l.empresa_id == empresa_id]
    elif empresa:
        licencas = [l for l in licencas if l.empresa == empresa]

    result = []
    for lic in licencas:
        result.append(
            {
                "empresa_id": lic.empresa_id,
                "empresa": lic.empresa,
                "tipo": lic.tipo,
                "status": lic.status_display,
                "validade": lic.validade or "—",
                "obs": lic.obs,
            }
        )
    return result


@app.get("/api/taxas", response_model=List[TaxaResponse])
def get_taxas():
    taxas: List[Taxa] = cache["taxas"]

    agrupado: Dict[int, Dict[str, Any]] = {}
    defaults = {
        output_key: ("*" if output_key != "status_geral" else None)
        for _, output_key in TAXA_TIPOS_OUTPUT
    }

    for taxa in taxas:
        if not taxa.empresa_id:
            continue
        linha = agrupado.setdefault(
            taxa.empresa_id,
            {
                "empresa_id": taxa.empresa_id,
                "empresa": taxa.empresa,
                **defaults,
            },
        )
        for tipo_label, output_key in TAXA_TIPOS_OUTPUT:
            if taxa.tipo == tipo_label:
                valor = taxa.status_display
                if output_key == "status_geral" and valor in {"", "*"}:
                    valor = None
                linha[output_key] = valor
                break

    result = sorted(
        agrupado.values(),
        key=lambda item: (item.get("empresa") or "").lower(),
    )
    return result


@app.get("/api/processos")
def get_processos(tipo: Optional[str] = None, apenas_ativos: bool = False):
    processos = filtrar_processos(
        cache["processos"], tipo=tipo, apenas_ativos=apenas_ativos
    )
    resultado = []
    for p in processos:
        resultado.append(
            {
                "empresa_id": p.empresa_id,
                "empresa": p.empresa,
                "cnpj": p.cnpj,
                "tipo": p.tipo,
                "protocolo": p.protocolo,
                "data_solicitacao": p.data_solicitacao,
                "situacao": p.situacao,
                "status": p.status_display,
                "status_padrao": p.status_padrao,
                "prazo": p.prazo,
                "obs": p.obs,
                "operacao": p.operacao,
                "orgao": p.orgao,
                "alvara": p.alvara,
                "municipio": p.municipio,
                "tpi": p.tpi,
                "inscricao_imobiliaria": p.inscricao_imobiliaria,
                "servico": p.servico,
                "taxa": p.taxa,
                "notificacao": p.notificacao,
                "data_val": p.data_val,
            }
        )
    return resultado


@app.get("/api/uteis", response_model=UteisResponse)
def get_uteis():
    contatos = sorted(
        cache["contatos"],
        key=lambda c: (
            (getattr(c, "categoria", "") or "").lower(),
            (getattr(c, "contato", "") or "").lower(),
        ),
    )
    modelos = sorted(
        cache["modelos"],
        key=lambda m: (
            (getattr(m, "utilizacao", "") or "").lower(),
            (getattr(m, "descricao", "") or "").lower(),
        ),
    )
    return UteisResponse(contatos=contatos, modelos=modelos)


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
            "licencas": [
                "ID",
                "EMPRESA",
                "CNPJ",
                "MUNICIPIO",
                "SANITARIA_STATUS",
                "SANITARIA_VAL",
            ],
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

        proc_sheet = _sheet_name("processos", "PROCESSOS")
        processos_tables = repo.config.get("table_names", {}).get("processos", {})
        processos_required = {
            "processos_diversos": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
            "processos_funcionamento": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
            "processos_bombeiros": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
            "processos_uso_solo": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
            "processos_sanitario": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
            "processos_ambiental": ["ID", "EMPRESA", "PROTOCOLO", "SITUACAO", "STATUS_PADRAO"],
        }
        for proc_key, table_name in processos_tables.items():
            sheet_key = f"processos_{proc_key}"
            try:
                repo.build_column_map_table(proc_sheet, table_name, sheet_key)
                colmap = repo.get_column_map(sheet_key)
                out["maps"][sheet_key] = colmap
                required_cols = processos_required.get(sheet_key, ["ID", "EMPRESA", "PROTOCOLO"])
                missing = [c for c in required_cols if c not in colmap]
                if missing:
                    out["warnings"].append(
                        f"{proc_sheet}/{table_name}: colunas ausentes {missing}"
                    )
            except Exception as exc:  # pragma: no cover - diagnóstico
                out["warnings"].append(
                    f"Erro ao mapear tabela {table_name}: {exc}"
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
