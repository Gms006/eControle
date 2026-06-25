import { normalizeText, removeDiacritics } from "@/lib/text";
import { parseInstallment } from "@/lib/installment";

export const EMPTY_STATUS_LABEL = "\u2014";

export const ALERT_STATUS_KEYWORDS = [
  "vencid",
  "vence",
  "nao_pago",
  "negad",
  "indefer",
  "abert",
  "irregular",
  "pendente",
];

export const PROCESS_INACTIVE_KEYWORDS = [
  "concluido",
  "licenciado",
  "aprovado",
  "indeferido",
  "negado",
  "finalizado",
  "arquiv",
  "cancel",
  "baix",
  "encerr",
  "deferid",
  "liber",
  "emitid",
  "exped",
  "entreg",
];

export const PROCESS_FOCUS_KEYWORDS = [
  "andament",
  "pend",
  "aguard",
  "analise",
  "tram",
  "vistori",
  "process",
  "solicit",
  "enviad",
  "protocol",
  "fiscaliz",
  "document",
  "pagament",
  "taxa",
  "abert",
  "receb",
];

export const getStatusKey = (status) =>
  removeDiacritics(String(status ?? ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

export const resolveStatusMapEntry = (map, raw, fallbackLabel) => {
  const key = getStatusKey(raw);
  if (map[key]) return map[key];
  const normalizedLabel = String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const label = fallbackLabel ?? (normalizedLabel || EMPTY_STATUS_LABEL);
  return { variant: "neutral", label };
};

export const withStatusAliases = (baseMap, aliases) => {
  const next = { ...baseMap };
  Object.entries(aliases).forEach(([from, to]) => {
    if (baseMap[to]) next[from] = baseMap[to];
  });
  return next;
};

export const canonicalStatusCandidates = (raw) => {
  const original = normalizeText(raw).trim();
  if (!original) return [""];
  const noDate = original.replace(/\s*[-\u2013]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/u, "").trim();
  const beforeDash = noDate.split(/\s[-\u2013]\s/u)[0]?.trim() || noDate;
  const candidates = [getStatusKey(original), getStatusKey(noDate), getStatusKey(beforeDash)];
  const deduped = [];
  for (const candidate of candidates) {
    if (candidate && !deduped.includes(candidate)) deduped.push(candidate);
  }
  return deduped.length > 0 ? deduped : [""];
};

export const hasRelevantStatus = (status) => {
  const statusText = normalizeText(status).trim();
  if (!statusText || statusText === "*" || statusText === "-" || statusText === EMPTY_STATUS_LABEL) {
    return false;
  }
  const statusKey = getStatusKey(statusText);
  return Boolean(statusKey && statusKey !== "*");
};

export const parseProgressFraction = (status) => {
  if (status === null || status === undefined) return null;
  const installment = parseInstallment(status);
  if (installment) return { current: installment.paid, total: installment.total };
  const text = normalizeText(status);
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const parseNumber = (value) => {
    const trimmed = value.replace(/\s+/g, "");
    const hasComma = trimmed.includes(",");
    const hasDot = trimmed.includes(".");
    const normalized = hasComma && hasDot ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  return { current: parseNumber(match[1]), total: parseNumber(match[2]) };
};

export const hasPendingFraction = (status) => {
  const fraction = parseProgressFraction(status);
  if (!fraction) return false;
  const { current, total } = fraction;
  if (!Number.isFinite(current) || !Number.isFinite(total)) return true;
  if (total <= 0) return true;
  return current < total;
};

export const isAlertStatus = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  if (key.includes("nao_se_aplica") || key.includes("n_a")) return false;
  if (hasPendingFraction(status)) return true;
  return ALERT_STATUS_KEYWORDS.some((keyword) => key.includes(keyword));
};

export const isProcessStatusInactive = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  return PROCESS_INACTIVE_KEYWORDS.some((keyword) => key.includes(keyword));
};

export const isProcessStatusActiveOrPending = (status) => {
  const key = getStatusKey(status);
  if (!key || key === "*" || key === "-" || key === EMPTY_STATUS_LABEL) return false;
  if (isProcessStatusInactive(status)) return false;
  if (hasPendingFraction(status)) return true;
  return PROCESS_FOCUS_KEYWORDS.some((keyword) => key.includes(keyword));
};
