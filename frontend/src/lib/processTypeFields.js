import { formatProcessDate, getDiversosOperacaoLabel } from "@/lib/process";
import { normalizeIdentifier, normalizeText, removeDiacritics } from "@/lib/text";

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const toKey = (value) =>
  removeDiacritics(normalizeText(value))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const formatText = (value) => {
  const text = normalizeText(value).trim();
  return text || "—";
};

const formatCaps = (value) => {
  const text = normalizeText(value).trim();
  return text ? text.toLocaleUpperCase("pt-BR") : "—";
};

const formatIdentifier = (value) => normalizeIdentifier(value) || "—";

const formatArea = (value) => {
  const text = normalizeText(value).trim();
  return text ? `${text} m²` : "—";
};

const getStatusFallback = (proc, key) => {
  if (key === "tpi_sync_status") {
    return proc?.tpi_sync_status ?? proc?.tpi;
  }
  if (key === "taxa_bombeiros_sync_status") {
    return proc?.taxa_bombeiros_sync_status ?? proc?.taxa_bombeiros ?? proc?.bombeiros;
  }
  if (key === "taxa_sanitaria_sync_status") {
    return proc?.taxa_sanitaria_sync_status ?? proc?.taxa;
  }
  return proc?.[key];
};

const FIELD_CONFIG_BY_TYPE = {
  DIVERSOS: [
    { key: "operacao", label: "Operação", priority: "high", format: "caps", value: (proc) => proc?.diversosOperacaoLabel || getDiversosOperacaoLabel(proc?.operacao) },
    { key: "orgao", label: "Órgão", priority: "medium", format: "caps" },
  ],
  FUNCIONAMENTO: [
    { key: "alvara", label: "Alvará", priority: "high", format: "caps" },
  ],
  BOMBEIROS: [
    { key: "area_m2", label: "Área (m²)", priority: "high", format: "area" },
    { key: "taxa_bombeiros_sync_status", label: "Taxa", priority: "high", format: "status" },
    { key: "tpi_sync_status", label: "TPI", priority: "high", format: "status" },
    { key: "projeto", label: "Projeto", priority: "medium", format: "text" },
  ],
  USO_DO_SOLO: [
    { key: "inscricao_imobiliaria", label: "Inscrição imobiliária", priority: "high", format: "identifier" },
  ],
  USO_SOLO: [
    { key: "inscricao_imobiliaria", label: "Inscrição imobiliária", priority: "high", format: "identifier" },
  ],
  LICENCA_AMBIENTAL: [
    { key: "operacao", label: "Operação", priority: "high", format: "caps" },
  ],
  AMBIENTAL: [
    { key: "operacao", label: "Operação", priority: "high", format: "caps" },
  ],
  SANITARIO: [
    { key: "servico", label: "Serviço", priority: "high", format: "caps" },
    { key: "notificacao", label: "Notificação", priority: "medium", format: "caps" },
    { key: "taxa_sanitaria_sync_status", label: "Taxa", priority: "high", format: "status" },
    { key: "alvara_sanitario_validade", label: "Validade", priority: "high", format: "date", value: (proc) => proc?.alvara_sanitario_validade ?? proc?.data_val },
    { key: "alvara_sanitario_status", label: "Status validade", priority: "medium", format: "status" },
  ],
  ALVARA_SANITARIO: [
    { key: "servico", label: "Serviço", priority: "high", format: "caps" },
    { key: "notificacao", label: "Notificação", priority: "medium", format: "caps" },
    { key: "taxa_sanitaria_sync_status", label: "Taxa", priority: "high", format: "status" },
    { key: "alvara_sanitario_validade", label: "Validade", priority: "high", format: "date", value: (proc) => proc?.alvara_sanitario_validade ?? proc?.data_val },
    { key: "alvara_sanitario_status", label: "Status validade", priority: "medium", format: "status" },
  ],
};

const formatValue = (field, rawValue) => {
  if (field.format === "caps") return formatCaps(rawValue);
  if (field.format === "identifier") return formatIdentifier(rawValue);
  if (field.format === "date") return formatProcessDate(rawValue);
  if (field.format === "area") return formatArea(rawValue);
  return formatText(rawValue);
};

export const getTypeFields = (proc) => {
  const typeKey = toKey(proc?.tipoKey || proc?.tipoBase || proc?.tipo);
  const config = FIELD_CONFIG_BY_TYPE[typeKey] || [];
  return config
    .map((field) => {
      const rawValue = field.value ? field.value(proc) : getStatusFallback(proc, field.key);
      return {
        ...field,
        rawValue,
        value: formatValue(field, rawValue),
        isMissing: formatText(rawValue) === "—",
        isStatus: field.format === "status",
      };
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
};

export const getPriorityTypeFields = (proc, max = 3) =>
  getTypeFields(proc)
    .filter((field) => field.priority === "high")
    .slice(0, max);
