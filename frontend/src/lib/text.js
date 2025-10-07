export const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

export const normalizeTextLower = (value) => normalizeText(value).toLowerCase();

export const removeDiacritics = (value) => {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const parsePtDate = (value) => {
  if (!value) return null;
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);
