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

export const resolveStatusClass = (status) => {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();

  if (trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—") {
    return { variant: "outline" };
  }

  const key = removeDiacritics(trimmed.toLowerCase());
  const normalizedKey = key.replace(/\s+/g, " ").trim();

  const palette = {
    "aguard docto": { variant: "warning" },
    "aguard pagto": { variant: "danger" },
    "em analise": { variant: "warning" },
    pendente: { variant: "neutral" },
    indeferido: { variant: "danger", className: "bg-rose-100 text-rose-800 border-rose-200" },
    concluido: { variant: "success" },
    licenciado: { variant: "success" },
    notificacao: { variant: "warning" },
    "aguard vistoria": { variant: "warning" },
    "aguard regularizacao": { variant: "danger" },
    "aguard liberacao": { variant: "warning" },
    "ir na visa": {
      variant: "outline",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
  };

  if (palette[normalizedKey]) {
    return palette[normalizedKey];
  }

  if (trimmed.includes("/")) {
    return { variant: "warning" };
  }

  if (normalizedKey === "valido") {
    return { variant: "success" };
  }

  if (normalizedKey === "vencido") {
    return { variant: "danger" };
  }

  const fraction = parseProgressFraction(trimmed);
  if (fraction) {
    const { current, total } = fraction;
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
      return { variant: "warning" };
    }
    if (current < total) {
      return { variant: "warning" };
    }
    return { variant: "success" };
  }

  if (key.includes("possui debit")) {
    return { variant: "danger" };
  }

  if (key.includes("sem debit") || key.includes("nao possui debit")) {
    return { variant: "success" };
  }

  if (key.includes("sujeit")) {
    return { variant: "warning" };
  }

  if (key.includes("valido")) {
    return { variant: "success" };
  }

  if (key.includes("vencid")) {
    return { variant: "danger" };
  }

  if (key.includes("vencend") || key.includes("vence")) {
    return { variant: "warning" };
  }

  if (key === "nao" || key.startsWith("nao ") || key.includes(" nao ")) {
    return { variant: "neutral" };
  }

  if (key.includes("possui")) {
    return { variant: "success" };
  }

  if (key.includes("pago") && !key.includes("nao")) {
    return { variant: "success" };
  }

  if (key.includes("em aberto") || key.includes("emaberto") || key.includes("nao pago")) {
    return { variant: "danger" };
  }

  if (key.includes("indefer") || key.includes("negad")) {
    return { variant: "danger" };
  }

  if (key.includes("conclu")) {
    return { variant: "success" };
  }

  if (key.includes("andament") || key.includes("aguard")) {
    return { variant: "warning" };
  }

  if (key.includes("pendent")) {
    return { variant: "neutral" };
  }

  if (key.includes("nao se aplica") || key.includes("n/a")) {
    return { variant: "neutral" };
  }

  if (key.includes("dispens") || key.includes("orient") || key.includes("inform") || key.includes("consult")) {
    return { variant: "neutral" };
  }

  if (
    key.includes("irregular") ||
    key.includes("suspens") ||
    key.includes("cancel") ||
    key.includes("bloque") ||
    key.includes("inadimpl")
  ) {
    return { variant: "danger" };
  }

  if (
    (key.includes("regular") && !key.includes("irregular")) ||
    key.includes("quit") ||
    key.includes("vigent") ||
    key.includes("ativo") ||
    (key.includes("em dia") && !key.includes("irregular")) ||
    (key === "sim" && !key.includes("irregular"))
  ) {
    return { variant: "success" };
  }

  return { variant: "neutral" };
};

export const formatStatusDisplay = (status) => {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();

  if (trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—") {
    return "—";
  }

  if (trimmed.toLowerCase() === "isento") {
    return "Isento";
  }

  return trimmed;
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
