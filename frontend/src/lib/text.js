const isNil = (value) => value === null || value === undefined;

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
