const isNil = (value) => value === null || value === undefined;
const NON_DIGIT_REGEX = /\D+/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;

export const normalizeText = (value) => {
  if (isNil(value)) {
    return "";
  }
  return String(value);
};

export const normalizeTextLower = (value) => normalizeText(value).toLowerCase();

export const removeDiacritics = (value) => {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const normalizeDocumentDigits = (value) => {
  const digits = normalizeText(value).replace(NON_DIGIT_REGEX, "");
  return digits === "" ? undefined : digits;
};

export const formatCnpj = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return undefined;
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

export const formatCpf = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return undefined;
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatCpfCnpj = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return undefined;
  if (digits.length === 11) {
    return formatCpf(digits);
  }
  if (digits.length === 14) {
    return formatCnpj(digits);
  }
  return digits;
};

export const formatPhoneBr = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return undefined;

  // 10 dígitos: (62) 3333-4444
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // 11 dígitos: (62) 9 3333-4444
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  return digits;
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
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "para"]);
const TOKEN_MAP = {
  cnae: "CNAE",
  tpi: "TPI",
  cercon: "CERCON",
  uso: "Uso",
  solo: "Solo",
  alvara: "Alvara",
  sanitario: "Sanitario",
  sanitaria: "Sanitaria",
  ambiental: "Ambiental",
  analise: "Analise",
  nao: "Nao",
  possui: "Possui",
  vencido: "Vencido",
  vencendo: "Vencendo",
  aguardando: "Aguardando",
};

const capitalizeToken = (token, index) => {
  const lower = token.toLowerCase();
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  const mapped = TOKEN_MAP[lower];
  if (mapped) return mapped;
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
};

export const formatCanonicalLabel = (value, fallback = "—") => {
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
