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
