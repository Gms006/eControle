import { resolveStatusMapEntry, withStatusAliases } from "@/lib/domain/status/common";

export const PROCESSO_TIPO_MAP = withStatusAliases(
  {
    diversos: { variant: "info", label: "Diversos" },
    funcionamento: { variant: "purple", label: "Funcionamento" },
    cercon: { variant: "fire", label: "CerCon" },
    uso_do_solo: { variant: "brown", label: "Uso do Solo" },
    alvara_sanitario: { variant: "teal", label: "Alv. Sanit\u00e1rio" },
  },
  {
    bombeiros: "cercon",
    sanitario: "alvara_sanitario",
  },
);

export const PROCESSO_STATUS_MAP = {
  pendente: { variant: "indigo", label: "Pendente" },
  em_analise: { variant: "warning", label: "Em an\u00e1lise" },
  em_andamento: { variant: "warning", label: "Em andamento" },
  aguardando_documento: { variant: "info", label: "Ag. documento" },
  aguardando_vistoria: { variant: "warning", label: "Ag. vistoria" },
  aguardando_pagamento: { variant: "warning", label: "Ag. pagamento" },
  aguardando_regularizacao: { variant: "danger", label: "Ag. regulariza\u00e7\u00e3o" },
  aguardando_liberacao: { variant: "warning", label: "Ag. libera\u00e7\u00e3o" },
  concluido: { variant: "success", label: "Conclu\u00eddo" },
  licenciado: { variant: "success", label: "Licenciado" },
  notificacao: { variant: "fire", label: "Notifica\u00e7\u00e3o" },
  indeferido: { variant: "fire", label: "Indeferido" },
  cancelado: { variant: "fire", label: "Cancelado" },
};

export const PROCESSO_URGENCIA_MAP = {
  overdue: { variant: "fire", label: "Vencido" },
  due7: { variant: "warning", label: "Vence em 7 dias" },
  awaiting_payment: { variant: "danger", label: "Ag. pagamento" },
  in_analysis: { variant: "warning", label: "Em an\u00e1lise" },
  incomplete: { variant: "purple", label: "Incompleto" },
};

export const PROCESSO_OPERACAO_MAP = {
  abertura: { variant: "success", label: "Abertura" },
  inscricao: { variant: "success", label: "Inscri\u00e7\u00e3o" },
  renovacao: { variant: "warning", label: "Renova\u00e7\u00e3o" },
  alteracao: { variant: "warning", label: "Altera\u00e7\u00e3o" },
  baixa: { variant: "danger", label: "Baixa" },
  restituicao: { variant: "purple", label: "Restitui\u00e7\u00e3o" },
  cancel_de_tributos: { variant: "danger", label: "Cancel. de tributos" },
  retificacao: { variant: "warning", label: "Retifica\u00e7\u00e3o" },
};

export const PROCESSO_ORGAO_MAP = {
  prefeitura: { variant: "purple", label: "Prefeitura" },
  bombeiros: { variant: "fire", label: "Bombeiros" },
  vigilancia_sanitaria: { variant: "teal", label: "Vig. Sanit\u00e1ria" },
};

export const PROCESSO_ALVARA_MAP = {
  sujeito: { variant: "danger", label: "Sujeito" },
  isento: { variant: "teal", label: "Isento" },
  nao_possui: { variant: "neutral", label: "N\u00e3o possui" },
};

export const PROCESSO_SERVICO_MAP = {
  licenciamento: { variant: "success", label: "Licenciamento" },
  "1\u00ba_alvara": { variant: "success", label: "1\u00ba Alvar\u00e1" },
  "1o_alvara": { variant: "success", label: "1\u00ba Alvar\u00e1" },
  renovacao: { variant: "warning", label: "Renova\u00e7\u00e3o" },
  vistoria: { variant: "info", label: "Vistoria" },
};

export const PROCESSO_NOTIFICACAO_MAP = {
  sem_notificacao: { variant: "success", label: "Sem notifica\u00e7\u00e3o" },
  notificado: { variant: "danger", label: "Notificado" },
  auto_infracao: { variant: "fire", label: "Auto de infra\u00e7\u00e3o" },
};

export const resolveProcessoTipo = (tipo) => resolveStatusMapEntry(PROCESSO_TIPO_MAP, tipo);
export const resolveProcessoStatus = (status) => resolveStatusMapEntry(PROCESSO_STATUS_MAP, status);
export const resolveProcessoUrgencia = (bucket) => resolveStatusMapEntry(PROCESSO_URGENCIA_MAP, bucket);
export const resolveProcessoOperacao = (operacao) => resolveStatusMapEntry(PROCESSO_OPERACAO_MAP, operacao);
export const resolveProcessoOrgao = (orgao) => resolveStatusMapEntry(PROCESSO_ORGAO_MAP, orgao);
export const resolveProcessoAlvara = (alvara) => resolveStatusMapEntry(PROCESSO_ALVARA_MAP, alvara);
export const resolveProcessoServico = (servico) => resolveStatusMapEntry(PROCESSO_SERVICO_MAP, servico);
export const resolveProcessoNotificacao = (notificacao) => resolveStatusMapEntry(PROCESSO_NOTIFICACAO_MAP, notificacao);
