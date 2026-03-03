from fastapi import APIRouter, Depends

from app.core.normalize import PROCESS_SITUACAO_LABELS
from app.core.security import require_roles


router = APIRouter()


@router.get("/enums")
def list_enums(
    _user=Depends(require_roles("ADMIN", "DEV", "VIEW")),
) -> dict:
    process_situacoes = [
        {"value": value, "label": label}
        for value, label in PROCESS_SITUACAO_LABELS.items()
    ]

    operacoes_diversos = [
        {"value": "alteracao", "label": "Alteração"},
        {"value": "inscricao", "label": "Inscrição"},
        {"value": "baixa", "label": "Baixa"},
        {"value": "cancel_de_tributos", "label": "Cancel de Tributos"},
        {"value": "restituicao", "label": "Restituição"},
        {"value": "retificacao", "label": "Retificação"},
    ]
    orgaos_diversos = [
        {"value": "prefeitura", "label": "Prefeitura"},
        {"value": "anp", "label": "ANP"},
        {"value": "rfb", "label": "RFB"},
        {"value": "cartorio_2o_tabelionato", "label": "Cartório 2º Tabelionato"},
    ]
    alvaras_funcionamento = [
        {"value": "condicionado", "label": "Condicionado"},
        {"value": "provisorio", "label": "Provisório"},
        {"value": "definitivo", "label": "Definitivo"},
    ]
    servicos_sanitarios = [
        {"value": "1o_alvara", "label": "1º Alvará"},
        {"value": "renovacao", "label": "Renovação"},
        {"value": "atualizacao", "label": "Atualização"},
    ]
    notificacoes_sanitarias = [
        {"value": "nao_informado", "label": "—"},
        {"value": "possui_pendencias", "label": "Possui Pendências"},
        {"value": "sem_pendencias", "label": "Sem Pendências"},
        {"value": "resolvidas", "label": "Resolvidas"},
        {"value": "pegar_original", "label": "Pegar Original"},
    ]
    categorias_contato = [
        {"value": "bombeiros", "label": "Bombeiros"},
        {"value": "postura", "label": "Postura"},
        {"value": "ambiental_uso_do_solo", "label": "Ambiental/Uso do Solo"},
        {"value": "visa", "label": "Visa"},
    ]

    return {
        "display_style": "title",
        # backward-compatible field
        "process_situacoes": process_situacoes,
        # canonical meta contract
        "situacao_processos": process_situacoes,
        "operacoes_diversos": operacoes_diversos,
        "orgaos_diversos": orgaos_diversos,
        "alvaras_funcionamento": alvaras_funcionamento,
        "servicos_sanitarios": servicos_sanitarios,
        "notificacoes_sanitarias": notificacoes_sanitarias,
        "categorias_contato": categorias_contato,
    }
