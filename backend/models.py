"""
models.py - Dataclasses para entidades do eControle
"""
from dataclasses import dataclass, field
from typing import Optional
from datetime import date


@dataclass
class Empresa:
    """Empresa (tabela Principal)"""
    id: int
    empresa: str
    cnpj: str
    porte: str
    municipio: str
    status_empresas: str = "Ativa"
    categoria: str = ""
    ie: str = "–"
    im: str = "Não Possui"
    situacao: str = "em dia"
    debito: str = "Não"
    certificado: str = "NÃO"
    obs: str = ""

    proprietario: str = ""
    cpf: str = ""
    telefone: str = ""
    email: str = ""
    responsavel: str = ""
    updated_at: Optional[str] = None

    def __post_init__(self):
        if self.updated_at is None:
            self.updated_at = date.today().isoformat()


@dataclass
class Licenca:
    """Licença (estrutura normalizada em memória)"""
    id: int
    empresa: str
    cnpj: str
    municipio: str
    tipo: str  # SANITÁRIA, CERCON, FUNCIONAMENTO, AMBIENTAL, USO_SOLO
    status: str
    validade: Optional[str] = None
    obs: str = ""

    @property
    def status_display(self) -> str:
        """Status formatado para exibição"""
        if self.status.startswith("Possui"):
            return "Possui"
        if self.status.startswith("Vencido"):
            return "Vencido"
        if "≤30d" in self.status or "Vence" in self.status:
            return "Vence≤30d"
        return self.status


@dataclass
class Taxa:
    """Taxa (estrutura normalizada em memória)"""
    id: int
    empresa: str
    cnpj: str
    tipo: str  # TPI, FUNCIONAMENTO, PUBLICIDADE, SANITÁRIA, etc.
    status: str
    data_envio: Optional[str] = None

    @property
    def status_display(self) -> str:
        """Status formatado para exibição"""
        if self.status == "Pago":
            return "Pago"
        if "pago" in self.status.lower() or "Aberto" in self.status:
            return "Não pago"
        if "Vencido" in self.status:
            return "Vencido"
        return self.status


@dataclass
class Processo:
    """Processo (comum a todos os tipos)"""
    id: int
    empresa: str
    cnpj: str
    tipo: str  # Diversos, Funcionamento, Bombeiros, etc.
    protocolo: str
    data_solicitacao: str
    situacao: str
    status_padrao: Optional[str] = None
    obs: str = ""
    prazo: Optional[str] = None
    # Campos específicos por tipo (opcionais)
    operacao: Optional[str] = None  # Diversos
    orgao: Optional[str] = None  # Diversos
    alvara: Optional[str] = None  # Funcionamento
    municipio: Optional[str] = None  # Funcionamento
    tpi: Optional[str] = None  # Bombeiros
    inscricao_imobiliaria: Optional[str] = None  # Uso do Solo
    servico: Optional[str] = None  # Sanitário
    taxa: Optional[str] = None  # Sanitário
    notificacao: Optional[str] = None  # Sanitário
    data_val: Optional[str] = None  # Sanitário

    @property
    def status_display(self) -> str:
        """Status padronizado para exibição."""
        return (self.status_padrao or self.situacao or "").strip()

    @property
    def status_cor(self) -> str:
        """Retorna emoji de cor baseado no status"""
        status_lower = self.status_display.lower()
        if "concluído" in status_lower or "aprovado" in status_lower or "licenciado" in status_lower:
            return "🟢"
        if "vencido" in status_lower or "indeferido" in status_lower:
            return "🔴"
        if "aguard" in status_lower or "pendente" in status_lower:
            return "🟡"
        return "🔵"


@dataclass
class Contato:
    """Contato útil"""
    contato: str
    municipio: str = ""
    telefone: str = ""
    whatsapp: str = "NÃO"
    email: str = ""
    categoria: str = ""

    def __str__(self):
        return f"{self.contato} ({self.categoria})"


@dataclass
class Modelo:
    """Modelo de mensagem"""
    modelo: str
    descricao: str = ""
    utilizacao: str = "WhatsApp"

    def __str__(self):
        return f"{self.descricao} ({self.utilizacao})"


@dataclass
class LicencaRaw:
    """Licença raw (estrutura larga do Excel) - uso temporário para leitura"""
    id: int
    empresa: str
    cnpj: str
    municipio: str
    sanitaria_status: str = "*"
    sanitaria_val: Optional[str] = None
    cercon_status: str = "*"
    cercon_val: Optional[str] = None
    funcionamento_status: str = "*"
    funcionamento_val: Optional[str] = None
    ambiental_status: str = "*"
    ambiental_val: Optional[str] = None
    uso_solo_status: str = "*"
    uso_solo_val: Optional[str] = None
    obs: str = ""


@dataclass
class TaxaRaw:
    """Taxa raw (estrutura larga do Excel) - uso temporário para leitura"""
    id: int
    empresa: str
    cnpj: str
    data_envio: str = ""
    funcionamento: str = "*"
    publicidade: str = "*"
    sanitaria: str = "*"
    localizacao_instalacao: str = "*"
    area_publica: str = "*"
    localizacao: str = "*"  # compatibilidade retroativa
    ocupacao: str = "*"  # compatibilidade retroativa
    bombeiros: str = "*"  # compatibilidade retroativa
    tpi: str = "*"
    status_taxas: str = "Regular"
    obs: str = ""
