const isNil = (value) => value === null || value === undefined;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "para"]);
const TOKEN_MAP = {
  cnae: "CNAE",
  tpi: "TPI",
  cercon: "CERCON",
  uso: "Uso",
  solo: "Solo",
  alvara: "Alvar\u00e1",
  sanitario: "Sanit\u00e1rio",
  sanitaria: "Sanit\u00e1ria",
  ambiental: "Ambiental",
  analise: "An\u00e1lise",
  nao: "N\u00e3o",
  possui: "Possui",
  vencido: "Vencido",
  vencendo: "Vencendo",
  aguardando: "Aguardando",
  renovacao: "Renova\u00e7\u00e3o",
  retificacao: "Retifica\u00e7\u00e3o",
  cancelamento: "Cancelamento",
  cancel: "Cancelamento",
  tributos: "Tributos",
  indeferido: "Indeferido",
  deferido: "Deferido",
  licenciado: "Licenciado",
  concluido: "Conclu\u00eddo",
  baixa: "Baixa",
  regularizacao: "Regulariza\u00e7\u00e3o",
  liberacao: "Libera\u00e7\u00e3o",
  emissao: "Emiss\u00e3o",
  processamento: "Processamento",
  execucao: "Execu\u00e7\u00e3o",
  inspecao: "Inspe\u00e7\u00e3o",
  auditoria: "Auditoria",
  supervisao: "Supervis\u00e3o",
  consulta: "Consulta",
  parecer: "Parecer",
  modificacao: "Modifica\u00e7\u00e3o",
  alteracao: "Altera\u00e7\u00e3o",
  cancelacao: "Cancela\u00e7\u00e3o",
};

export const normalizeText = (value) => {
  if (isNil(value)) return "";
  return String(value);
};

export const normalizeTextLower = (value) => normalizeText(value).toLowerCase();

export const removeDiacritics = (value) => {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const buildNormalizedSearchKey = (value) => {
  const normalized = removeDiacritics(normalizeTextLower(value));
  const sanitized = normalized.replace(NON_ALPHANUMERIC_REGEX, "");
  return sanitized === "" ? undefined : sanitized;
};

export const normalizeIdentifier = (value) => {
  const normalized = normalizeText(value).trim();
  return normalized === "" ? undefined : normalized;
};

export const parsePtDate = (value) => {
  if (!value) return null;
  const [day, month, year] = String(value).split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);

const capitalizeToken = (token, index) => {
  const lower = token.toLowerCase();
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  const mapped = TOKEN_MAP[lower];
  if (mapped) return mapped;
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
};

export const formatCanonicalLabel = (value, fallback = "\u2014") => {
  const text = normalizeText(value).trim();
  if (!text) return fallback;
  const cleaned = removeDiacritics(text)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned
    .split(" ")
    .map((token, index) => capitalizeToken(token, index))
    .join(" ");
};
