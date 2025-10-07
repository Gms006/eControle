import { normalizeText, normalizeTextLower, removeDiacritics } from "@/lib/text";

export const ALERT_STATUS_KEYWORDS = [
  "vencid",
  "vence",
  "nao pago",
  "nao-pago",
  "negad",
  "indefer",
  "abert",
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

export const getStatusKey = (status) => removeDiacritics(normalizeTextLower(status));

export const hasRelevantStatus = (status) => {
  const statusText = normalizeText(status).trim();
  if (!statusText || statusText === "*" || statusText === "-" || statusText === "—") {
    return false;
  }
  const statusKey = getStatusKey(statusText);
  return Boolean(statusKey && statusKey !== "*");
};

export const parseProgressFraction = (status) => {
  if (status === null || status === undefined) {
    return null;
  }
  const text = normalizeText(status);
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }
  const parseNumber = (value) => {
    const trimmed = value.replace(/\s+/g, "");
    const hasComma = trimmed.includes(",");
    const hasDot = trimmed.includes(".");
    const normalized = hasComma && hasDot
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const current = parseNumber(match[1]);
  const total = parseNumber(match[2]);
  return { current, total };
};

export const hasPendingFraction = (status) => {
  const fraction = parseProgressFraction(status);
  if (!fraction) {
    return false;
  }
  const { current, total } = fraction;
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    return true;
  }
  if (total <= 0) {
    return true;
  }
  return current < total;
};

export const isAlertStatus = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  if (key.includes("nao se aplica") || key.includes("n/a")) return false;
  if (hasPendingFraction(status)) {
    return true;
  }
  return ALERT_STATUS_KEYWORDS.some((keyword) => key.includes(keyword));
};

export const STATUS_VARIANT_CLASSES = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  info: "bg-sky-100 text-sky-700 border-sky-200",
  neutral: "bg-slate-200 text-slate-700 border-slate-300",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
  plain: "bg-transparent border-transparent text-slate-500",
};

export const resolveStatusClass = (status) => {
  const key = getStatusKey(status);
  if (!key || key === "*" || key === "-" || key === "—") {
    return { variant: "plain", className: STATUS_VARIANT_CLASSES.plain };
  }

  const fraction = parseProgressFraction(status);
  if (fraction) {
    const { current, total } = fraction;
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
      return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
    }
    if (current < total) {
      return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
    }
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key === "/") {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key.includes("possui debit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("sem debit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("possui")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("pago") && !key.includes("nao")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("em aberto") || key.includes("emaberto") || key.includes("nao pago")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("sujeit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("vencid") || key.includes("vence")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key === "nao" || key.includes("nao possui") || key.includes("nao tem")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.muted };
  }

  if (key.includes("indefer") || key.includes("negad")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("em andament") || key.includes("aguard")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key.includes("pend")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.neutral };
  }

  if (
    (key.includes("conclu") || key.includes("aprov") || key.includes("licenc") || key.includes("defer") || key.includes("emit"))
  ) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("nao se aplica") || key.includes("n/a")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.info };
  }

  if (key.includes("dispens") || key.includes("orient") || key.includes("inform") || key.includes("consult")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.info };
  }

  if (
    key.includes("irregular") ||
    key.includes("suspens") ||
    key.includes("cancel") ||
    key.includes("bloque") ||
    key.includes("inadimpl")
  ) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (
    (key.includes("regular") && !key.includes("irregular")) ||
    key.includes("quit") ||
    key.includes("vigent") ||
    key.includes("ativo") ||
    (key.includes("em dia") && !key.includes("irregular")) ||
    (key === "sim" && !key.includes("irregular"))
  ) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  return { variant: "solid", className: STATUS_VARIANT_CLASSES.neutral };
};

export const isProcessStatusInactive = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  return PROCESS_INACTIVE_KEYWORDS.some((keyword) => key.includes(keyword));
};

export const isProcessStatusActiveOrPending = (status) => {
  const key = getStatusKey(status);
  if (!key || key === "*" || key === "-" || key === "—") {
    return false;
  }
  if (isProcessStatusInactive(status)) {
    return false;
  }
  if (hasPendingFraction(status)) {
    return true;
  }
  return PROCESS_FOCUS_KEYWORDS.some((keyword) => key.includes(keyword));
};
