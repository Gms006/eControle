import { resolveStatusMapEntry } from "@/lib/domain/status/common";

export const LICENCA_TIPO_MAP = {
  sanitaria: { variant: "teal", label: "Sanit\u00e1ria" },
  cercon: { variant: "danger", label: "CerCon" },
  funcionamento: { variant: "purple", label: "Funcionamento" },
  uso_do_solo: { variant: "brown", label: "Uso do Solo" },
  ambiental: { variant: "success", label: "Ambiental" },
};

export const LICENCA_STATUS_MAP = {
  possui: { variant: "success", label: "Possui" },
  definitivo: { variant: "success", label: "Definitivo" },
  vencido: { variant: "warning", label: "Vencido" },
  sujeito: { variant: "danger", label: "Sujeito" },
  nao_possui: { variant: "purple", label: "N\u00e3o possui" },
  nao_exigido: { variant: "teal", label: "N\u00e3o exigido" },
  isento: { variant: "teal", label: "Isento" },
  aguardando_documento: { variant: "info", label: "Ag. documento" },
  aguardando_vistoria: { variant: "warning", label: "Ag. vistoria" },
  aguardando_pagamento: { variant: "warning", label: "Ag. pagamento" },
  aguardando_regularizacao: { variant: "danger", label: "Ag. regulariza\u00e7\u00e3o" },
  aguardando_liberacao: { variant: "warning", label: "Ag. libera\u00e7\u00e3o" },
  em_analise: { variant: "warning", label: "Em an\u00e1lise" },
  notificacao: { variant: "fire", label: "Notifica\u00e7\u00e3o" },
  ir_na_visa: { variant: "indigo", label: "Ir na VISA" },
};

export const NAO_EXIGIDO_MOTIVO_MAP = {
  atividade_nao_exige: { variant: "teal", label: "Atividade n\u00e3o exige" },
  zoneamento_nao_aplica: { variant: "teal", label: "Zoneamento n\u00e3o aplica" },
  porte_dispensado: { variant: "teal", label: "Porte dispensado" },
  fase_pre_operacional: { variant: "warning", label: "Pr\u00e9-operacional" },
  mei: { variant: "teal", label: "MEI" },
  endereco_administrativo_fiscal: { variant: "teal", label: "End. administrativo/fiscal" },
  outro: { variant: "neutral", label: "Outro" },
};

export const resolveLicencaTipo = (tipo) => resolveStatusMapEntry(LICENCA_TIPO_MAP, tipo);
export const resolveLicencaStatus = (status) => resolveStatusMapEntry(LICENCA_STATUS_MAP, status);
export const resolveNaoExigidoMotivo = (motivo) => resolveStatusMapEntry(NAO_EXIGIDO_MOTIVO_MAP, motivo);
