from enum import Enum

# 1) CADASTRO / ESTRUTURA
class LicencaTipo(str, Enum):
    ALVARA_SANITARIO = "Alvará Sanitário"
    ALVARA_BOMBEIROS = "Alvará Bombeiros"
    ALVARA_FUNCIONAMENTO = "Alvará Funcionamento"
    LICENCA_AMBIENTAL = "Licença Ambiental"
    USO_DO_SOLO = "Certidão Uso do Solo"
    SICABOM_TPI = "SICABOM (TPI)"
    CERTIFICADO_DIGITAL = "Certificado Digital"

class TaxaTipo(str, Enum):
    FUNCIONAMENTO = "Taxa Funcionamento"
    PUBLICIDADE = "Taxa Publicidade"
    ISS = "ISS"
    VIG_SANITARIA = "Taxa Vigilância Sanitária"
    LOCALIZACAO_INSTALACAO = "Taxa Localização/Instalação"
    OCUP_AREA_PUBLICA = "Taxa Ocupação Área Pública"
    BOMBEIROS = "Taxa Bombeiros"
    TPI = "TPI (SICABOM)"

# 2) LICENÇAS / CERTIDÕES
class LicencaSituacao(str, Enum):
    POSSUI = "Possui"
    VENCIDO = "Vencido"
    SUJEITO = "Sujeito"
    DISPENSA = "Dispensa"
    NAO_SE_APLICA = "*"     # não se aplica
    NAO = "NÃO"              # caso especial

class AlvaraCategoria(str, Enum):
    CONDICIONADO = "CONDICIONADO"
    PROVISORIO = "PROVISÓRIO"
    DEFINITIVO = "DEFINITIVO"

class TPIStatus(str, Enum):  # unifica envio/pagamento
    EMITIR = "EMITIR"
    ENVIADO = "ENVIADO"
    PAGO = "PAGO"
    NAO_INFORMADO = "-"      # vazio/traço

class CertificadoDigital(str, Enum):
    SIM = "SIM"
    NAO = "NÃO"

# 3) PROCESSOS
class ProcessoOperacao(str, Enum):
    ALTERACAO = "ALTERAÇÃO"
    INSCRICAO = "INSCRIÇÃO"
    BAIXA = "BAIXA"
    CANCEL_TRIBUTOS = "CANCEL DE TRIBUTOS"
    RESTITUICAO = "RESTITUIÇÃO"

class ProcessoSituacao(str, Enum):
    AGUARD_DOCTO = "AGUARD DOCTO"
    AGUARD_PAGTO = "AGUARD PAGTO"
    EM_ANALISE = "EM ANÁLISE"
    PENDENTE = "PENDENTE"
    INDEFERIDO = "INDEFERIDO"
    CONCLUIDO = "CONCLUÍDO"
    LICENCIADO = "LICENCIADO"
    NOTIFICACAO = "NOTIFICAÇÃO"
    AGUARD_VISTORIA = "AGUARD VISTORIA"
    AGUARD_REGULARIZACAO = "AGUARD REGULARIZAÇÃO"
    AGUARD_LIBERACAO = "AGUARD LIBERAÇÃO"
    IR_NA_VISA = "IR NA VISA"

class ProcessoServico(str, Enum):
    PRIMEIRO_ALVARA = "1º ALVARÁ"
    RENOVACAO = "RENOVAÇÃO"
    ATUALIZACAO = "ATUALIZAÇÃO"

class ProcessoNotificacao(str, Enum):
    NENHUMA = "-"
    POSSUI_PENDENCIAS = "POSSUI PENDÊNCIAS"
    SEM_PENDENCIAS = "SEM PENDÊNCIAS"
    RESOLVIDAS = "RESOLVIDAS"
    PEGAR_ORIGINAL = "PEGAR ORIGINAL"

class ProcessoOrgao(str, Enum):
    PREFEITURA = "PREFEITURA"
    ANP = "ANP"
    OUTRO = "OUTRO"

# 4) TAXAS
class TaxaSituacao(str, Enum):
    PAGO = "Pago"
    EM_ABERTO = "Em aberto"
    PARCELADO = "Parcelado"                     # detalhar em campos numericos
    ANOS_ANTERIORES_ABERTO = "Anos anteriores em aberto"  # detalhar anos
    ISENTO = "*"

# 5) CHECKLISTS (documentos)
class ChecklistStatus(str, Enum):
    ENTREGUE = "Entregue"
    PENDENTE = "Pendente"
    NAO_APLICA = "Não se aplica"

class FuncionamentoDoc(str, Enum):
    REQUERIMENTO = "Requerimento"
    CNPJ = "CNPJ"
    CAE = "CAE"
    CERCON = "CERCON"
    ALVARA_SANITARIO = "Alvará Sanitário"
    LICENCA_AMBIENTAL = "Licença Ambiental"
    USO_DO_SOLO = "Uso do Solo"
    CONTRATO_SOCIAL = "Contrato Social"
    DOC_IMOVEL_DEFINITIVO = "Documento Imóvel (Definitivo)"
    DOC_IMOVEL_CONDICIONADO = "Documento Imóvel (Condicionado)"

class CerconDoc(str, Enum):
    NF_EXTINTORES = "NF dos Extintores"
    FOTO_EXTINTORES_PLACAS = "Foto dos extintores e placas"
    FOTO_FACHADA = "Foto da fachada"
    AREA_UTILIZADA = "Área utilizada"
    ART_CENTRAL_GLP = "ART (se tiver central GLP)"
    PROJETO_APROVADO = "Projeto aprovado"
