import { getStatusKey, resolveStatusMapEntry, withStatusAliases } from "@/lib/domain/status/common";

export const TAXA_TIPO_MAP = withStatusAliases(
  {
    tpi: { variant: "danger", label: "TPI" },
    publicidade: { variant: "indigo", label: "Publicidade" },
    localizacao_instalacao: { variant: "warning", label: "Localiz. / Instala\u00e7\u00e3o" },
    bombeiros: { variant: "fire", label: "Bombeiros" },
    func: { variant: "purple", label: "Funcionamento" },
    sanitaria: { variant: "teal", label: "Sanit\u00e1ria" },
    area_publica: { variant: "success", label: "\u00c1rea p\u00fablica" },
  },
  {
    taxa_funcionamento: "func",
    taxa_publicidade: "publicidade",
    taxa_vig_sanitaria: "sanitaria",
    taxa_localiz_instalacao: "localizacao_instalacao",
    taxa_ocup_area_publica: "area_publica",
    taxa_bombeiros: "bombeiros",
  },
);

export const TAXA_STATUS_EDICAO_MAP = {
  em_aberto: { variant: "danger", label: "Em aberto" },
  parcelado: { variant: "warning", label: "Parcelado" },
  pago: { variant: "success", label: "Pago" },
  isento: { variant: "teal", label: "Isento" },
  nao_aplicavel: { variant: "indigo", label: "N/A" },
  pendente: { variant: "neutral", label: "Pendente" },
  "": { variant: "neutral", label: "Pendente" },
};

export const TAXA_STATUS_FILA_MAP = {
  em_aberto: { variant: "danger", label: "Em aberto" },
  vencidas: { variant: "fire", label: "Vencidas" },
  vence_7_dias: { variant: "warning", label: "Vence em 7 dias" },
  sem_status: { variant: "neutral", label: "Sem status" },
  isentas: { variant: "teal", label: "Isentas" },
  parcelado_andamento: { variant: "warning", label: "Parcelado / andamento" },
  envio_pendente: { variant: "purple", label: "Envio pendente" },
};

export const TAXA_STATUS_GERAL_MAP = {
  regular: { variant: "success", label: "Regular" },
  irregular: { variant: "danger", label: "Irregular" },
};

export const resolveTaxaTipo = (tipo) => resolveStatusMapEntry(TAXA_TIPO_MAP, tipo);
export const resolveTaxaStatusEdicao = (status) => TAXA_STATUS_EDICAO_MAP[getStatusKey(status)] ?? TAXA_STATUS_EDICAO_MAP[""];
export const resolveTaxaStatusFila = (status) => resolveStatusMapEntry(TAXA_STATUS_FILA_MAP, status);
export const resolveTaxaStatusGeral = (status) => resolveStatusMapEntry(TAXA_STATUS_GERAL_MAP, status);
