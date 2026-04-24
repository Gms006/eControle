from fastapi import APIRouter, Depends

from app.core.normalize import PROCESS_SITUACAO_LABELS
from app.core.regulatory import (
    ADDRESS_LOCATION_TYPE_VALUES,
    ADDRESS_USAGE_TYPE_VALUES,
    ALVARA_FUNCIONAMENTO_KIND_VALUES,
    SANITARY_COMPLEXITY_VALUES,
)
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
    alvara_funcionamento_kinds = [
        {"value": value, "label": value.replace("_", " ").title()}
        for value in ALVARA_FUNCIONAMENTO_KIND_VALUES
    ]
    sanitary_complexities = [
        {"value": value, "label": value.replace("_", " ").title()}
        for value in SANITARY_COMPLEXITY_VALUES
    ]
    address_usage_types = [
        {"value": value, "label": value.replace("_", " ").title()}
        for value in ADDRESS_USAGE_TYPE_VALUES
    ]
    address_location_types = [
        {"value": value, "label": value.replace("_", " ").title()}
        for value in ADDRESS_LOCATION_TYPE_VALUES
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
        "alvara_funcionamento_kinds": alvara_funcionamento_kinds,
        "sanitary_complexities": sanitary_complexities,
        "address_usage_types": address_usage_types,
        "address_location_types": address_location_types,
        "servicos_sanitarios": servicos_sanitarios,
        "notificacoes_sanitarias": notificacoes_sanitarias,
        "categorias_contato": categorias_contato,
    }
