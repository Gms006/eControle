"""
services.py - Validações, transformações e lógica de negócio
"""
import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta, date
import logging

from models import (
    Empresa, Licenca, Taxa, Processo, Contato, Modelo,
    LicencaRaw, TaxaRaw
)

logger = logging.getLogger(__name__)


# ============================================================================
# VALIDAÇÕES
# ============================================================================

def validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ com dígitos verificadores"""
    cnpj = re.sub(r'\D', '', cnpj)
    
    if len(cnpj) != 14:
        return False
    
    if cnpj == cnpj[0] * 14:
        return False
    
    # Primeiro dígito verificador
    soma = sum(int(cnpj[i]) * (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)[i] for i in range(12))
    digito1 = 11 - (soma % 11)
    if digito1 >= 10:
        digito1 = 0
    
    if int(cnpj[12]) != digito1:
        return False
    
    # Segundo dígito verificador
    soma = sum(int(cnpj[i]) * (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)[i] for i in range(13))
    digito2 = 11 - (soma % 11)
    if digito2 >= 10:
        digito2 = 0
    
    return int(cnpj[13]) == digito2


def validar_data(data_str: str, formato: str = "%Y-%m-%d") -> bool:
    """Valida formato de data"""
    try:
        datetime.strptime(data_str, formato)
        return True
    except (ValueError, TypeError):
        return False


def validar_empresa(empresa: Empresa) -> List[str]:
    """Valida campos obrigatórios de empresa"""
    erros = []
    
    if not empresa.empresa or empresa.empresa.strip() == "":
        erros.append("Nome da empresa é obrigatório")
    
    if not validar_cnpj(empresa.cnpj):
        erros.append("CNPJ inválido")
    
    if not empresa.municipio or empresa.municipio.strip() == "":
        erros.append("Município é obrigatório")
    
    return erros


# ============================================================================
# NORMALIZAÇÃO (em memória)
# ============================================================================

def normalizar_licencas(licencas_raw: List[LicencaRaw]) -> List[Licenca]:
    """
    Transforma estrutura 'larga' (uma linha por empresa, múltiplas colunas)
    em estrutura 'longa' (uma linha por licença)
    """
    licencas_norm = []

    tipos_map = {
        "sanitaria": "Sanitária",
        "cercon": "CERCON",
        "funcionamento": "Funcionamento",
        "ambiental": "Ambiental",
        "uso_solo": "Uso do Solo"
    }

    for raw in licencas_raw:
        if not getattr(raw, "empresa_id", None):
            continue
        for campo, tipo in tipos_map.items():
            status_attr = f"{campo}_status"
            val_attr = f"{campo}_val"

            status_raw = getattr(raw, status_attr, getattr(raw, campo, "*"))
            validade_raw = getattr(raw, val_attr, None)

            status_raw = "*" if status_raw in ("", None) else str(status_raw).strip()
            validade = _coerce_date_value(validade_raw)

            status, validade_embutida = _parse_status_licenca(status_raw)
            if not validade and validade_embutida:
                validade = validade_embutida

            if validade:
                if status in {"*", ""}:
                    status = calcular_status_vencimento(validade)
                elif status not in {"Dispensa", "Sujeito", "Possui", "Vencido", "Vence≤30d"}:
                    status = calcular_status_vencimento(validade)

            status = status.strip() if isinstance(status, str) else status
            if status in {"", "*"}:
                continue

            licencas_norm.append(Licenca(
                empresa_id=raw.empresa_id,
                empresa=raw.empresa,
                cnpj=raw.cnpj,
                municipio=raw.municipio,
                tipo=tipo,
                status=status,
                validade=validade,
                obs=raw.obs
            ))

    return licencas_norm


def normalizar_taxas(taxas_raw: List[TaxaRaw]) -> List[Taxa]:
    """
    Transforma estrutura 'larga' em 'longa'
    """
    taxas_norm = []

    tipos_map = [
        ("tpi", "TPI"),
        ("funcionamento", "Funcionamento"),
        ("publicidade", "Publicidade"),
        ("sanitaria", "Sanitária"),
        ("localizacao_instalacao", "Localização/Instalação"),
        ("localizacao", "Localização/Instalação"),
        ("area_publica", "Área Pública"),
        ("ocupacao", "Área Pública"),
        ("bombeiros", "Bombeiros"),
        ("status_taxas", "Status Geral"),
    ]

    for raw in taxas_raw:
        if not getattr(raw, "empresa_id", None):
            continue
        status_por_tipo: Dict[str, str] = {}

        for campo, tipo in tipos_map:
            status_raw = getattr(raw, campo, "*")
            if status_raw in ("", None):
                status_raw = "*"
            status_raw = str(status_raw)

            atual = status_por_tipo.get(tipo)
            if atual is None or (atual == "*" and status_raw != "*"):
                status_por_tipo[tipo] = status_raw

        for tipo, status_valor in status_por_tipo.items():
            taxas_norm.append(Taxa(
                empresa_id=raw.empresa_id,
                empresa=raw.empresa,
                cnpj=raw.cnpj,
                tipo=tipo,
                status=status_valor,
                data_envio=raw.data_envio
            ))

    return taxas_norm


def _parse_status_licenca(status_raw: str) -> tuple[str, Optional[str]]:
    """
    Parse de status de licença:
    'Possui. Val 31/12/2025' -> ('Possui', '31/12/2025')
    'Vencido. Val 08/03/2023' -> ('Vencido', '08/03/2023')
    """
    if "Possui" in status_raw:
        match = re.search(r'(\d{2}/\d{2}/\d{4})', status_raw)
        return ("Possui", match.group(1) if match else None)
    
    if "Vencido" in status_raw:
        match = re.search(r'(\d{2}/\d{2}/\d{4})', status_raw)
        return ("Vencido", match.group(1) if match else None)
    
    if "Dispensa" in status_raw:
        return ("Dispensa", None)
    
    if "Sujeito" in status_raw:
        return ("Sujeito", None)
    
    return (status_raw.strip() or "*", None)


def _coerce_date_value(value) -> Optional[str]:
    """Normaliza valores de data vindos de strings ou números para dd/mm/YYYY."""
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    if isinstance(value, (int, float)):
        try:
            base = datetime(1899, 12, 30)
            convertido = base + timedelta(days=float(value))
            return convertido.strftime("%d/%m/%Y")
        except (OverflowError, ValueError):
            return None

    texto = str(value).strip()
    return texto or None


# ============================================================================
# FILTROS (reutilizáveis, testáveis)
# ============================================================================

def filtrar_empresas(
    empresas: List[Empresa],
    query: Optional[str] = None,
    municipio: Optional[str] = None,
    so_alertas: bool = False
) -> List[Empresa]:
    """Filtro reutilizável de empresas"""
    resultado = empresas
    
    if query:
        q = query.lower()
        resultado = [
            e for e in resultado
            if q in e.empresa.lower() or
               q in e.cnpj.lower() or
               q in e.municipio.lower() or
               q in e.categoria.lower()
        ]
    
    if municipio:
        resultado = [e for e in resultado if e.municipio == municipio]
    
    if so_alertas:
        resultado = [
            e for e in resultado
            if e.debito == "Sim" or e.certificado == "NÃO"
        ]
    
    return resultado


def filtrar_processos(
    processos: List[Processo],
    tipo: Optional[str] = None,
    situacao: Optional[str] = None,
    apenas_ativos: bool = False
) -> List[Processo]:
    """Filtro de processos"""
    resultado = processos
    
    if tipo:
        resultado = [p for p in resultado if p.tipo == tipo]

    if situacao:
        resultado = [
            p for p in resultado
            if (p.status_padrao or p.situacao) == situacao
        ]

    if apenas_ativos:
        inativos = {"CONCLUÍDO", "LICENCIADO", "Aprovado", "INDEFERIDO"}
        resultado = [
            p for p in resultado
            if (p.status_padrao or p.situacao) not in inativos
        ]

    return resultado


# ============================================================================
# MÉTRICAS (helpers para UI)
# ============================================================================

def contar_licencas_por_status(licencas: List[Licenca], empresa_id: int) -> Dict[str, int]:
    """Conta licenças por status para uma empresa"""
    lics = [l for l in licencas if l.empresa_id == empresa_id]

    return {
        "ativas": len([l for l in lics if l.status_display == "Possui"]),
        "vencendo": len([l for l in lics if l.status_display == "Vence≤30d"]),
        "vencidas": len([l for l in lics if l.status_display == "Vencido"]),
        "total": len([l for l in lics if l.status_display not in {"", "*"}])
    }


def contar_taxas_pendentes(taxas: List[Taxa], empresa_id: int) -> int:
    """Conta taxas pendentes de uma empresa"""
    txs = [t for t in taxas if t.empresa_id == empresa_id]
    pendentes = [
        t for t in txs
        if t.status_display in ["Não pago", "Vencido"] or "Aberto" in t.status
    ]
    return len(pendentes)


def contar_processos_empresa(processos: List[Processo], empresa_id: int) -> int:
    """Conta processos de uma empresa"""
    return len([p for p in processos if p.empresa_id == empresa_id])


def calcular_kpis_globais(
    empresas: List[Empresa],
    licencas: List[Licenca],
    taxas: List[Taxa]
) -> Dict[str, int]:
    """Calcula KPIs do painel principal"""
    return {
        "total_empresas": len(empresas),
        "sem_certificado": len([e for e in empresas if e.certificado == "NÃO"]),
        "licencas_vencidas": len([l for l in licencas if l.status_display == "Vencido"]),
        "tpi_pendente": len([t for t in taxas if t.tipo == "TPI" and t.status_display != "Pago"])
    }


# ============================================================================
# HELPERS DE FORMATAÇÃO
# ============================================================================

def formatar_cnpj(cnpj: str) -> str:
    """Formata CNPJ: 10437430000106 -> 10.437.430/0001-06"""
    cnpj = re.sub(r'\D', '', cnpj)
    if len(cnpj) != 14:
        return cnpj
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"


def formatar_telefone(telefone: str) -> str:
    """Formata telefone: 62999990001 -> (62) 9 9999-0001"""
    tel = re.sub(r'\D', '', telefone)
    if len(tel) == 11:
        return f"({tel[:2]}) {tel[2]} {tel[3:7]}-{tel[7:]}"
    if len(tel) == 10:
        return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"
    return telefone


def formatar_data(data_iso: str, formato_saida: str = "%d/%m/%Y") -> str:
    """Converte data ISO para formato brasileiro"""
    try:
        dt = datetime.strptime(data_iso, "%Y-%m-%d")
        return dt.strftime(formato_saida)
    except (ValueError, TypeError):
        return data_iso


def dias_ate_vencimento(data_str: str) -> Optional[int]:
    """Calcula dias até vencimento (formato dd/mm/yyyy)"""
    try:
        data = datetime.strptime(data_str, "%d/%m/%Y")
        hoje = datetime.now()
        return (data - hoje).days
    except (ValueError, TypeError):
        return None


def calcular_status_vencimento(validade: Optional[str]) -> str:
    """
    Retorna status baseado em validade:
    - Vencido se < hoje
    - Vence≤30d se ≤30 dias
    - Possui se válido
    """
    if not validade:
        return "Possui"
    
    dias = dias_ate_vencimento(validade)
    if dias is None:
        return "Possui"
    
    if dias < 0:
        return "Vencido"
    if dias <= 30:
        return "Vence≤30d"
    return "Possui"


# ============================================================================
# TRANSIÇÕES DE STATUS
# ============================================================================

def pode_transicionar(status_atual: str, status_novo: str, tipo_entidade: str) -> bool:
    """
    Valida se transição de status é permitida
    """
    # Processos: fluxo típico
    if tipo_entidade == "processo":
        invalidos = {"CONCLUÍDO", "LICENCIADO", "INDEFERIDO"}
        if status_atual in invalidos:
            return False  # Estados finais não podem mudar
    
    return True


# ============================================================================
# TESTES (self-tests)
# ============================================================================

def executar_testes() -> Dict[str, bool]:
    """Executa suite de testes básicos"""
    resultados = {}
    
    # Teste CNPJ
    resultados["cnpj_valido"] = validar_cnpj("10.437.430/0001-06")
    resultados["cnpj_invalido"] = not validar_cnpj("11.111.111/1111-11")
    
    # Teste filtros
    empresas_mock = [
        Empresa(1, "Empresa A", "10437430000106", "ME", "Anápolis", debito="Não"),
        Empresa(2, "Empresa B", "54163509000178", "EPP", "Goiânia", debito="Sim"),
    ]
    resultados["filtro_municipio"] = len(
        filtrar_empresas(empresas_mock, municipio="Anápolis")
    ) == 1
    resultados["filtro_alertas"] = len(
        filtrar_empresas(empresas_mock, so_alertas=True)
    ) == 1
    
    # Teste normalização
    licenca_raw = LicencaRaw(
        1,
        "Teste",
        "123",
        "Anápolis",
        sanitaria_status="Possui",
        sanitaria_val="31/12/2025",
    )
    licencas_norm = normalizar_licencas([licenca_raw])
    resultados["normalizacao_licenca"] = len(licencas_norm) == 5  # 5 tipos
    
    return resultados