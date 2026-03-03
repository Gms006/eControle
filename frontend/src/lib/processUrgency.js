import dayjs from "dayjs";
import { getStatusKey, isProcessStatusInactive } from "@/lib/status";
import { normalizeText, removeDiacritics } from "@/lib/text";
import { getPriorityTypeFields } from "@/lib/processTypeFields";

const TYPE_WEIGHT = {
  SANITARIO: 130,
  ALVARA_SANITARIO: 130,
  CERCON: 110,
  BOMBEIROS: 110,
  FUNCIONAMENTO: 90,
  USO_DO_SOLO: 70,
  DIVERSOS: 50,
};

const STATUS_WEIGHT_RULES = [
  { keywords: ["aguard", "pag"], weight: 120 },
  { keywords: ["nao", "pago"], weight: 120 },
  { keywords: ["em", "analise"], weight: 90 },
  { keywords: ["aguard", "document"], weight: 80 },
  { keywords: ["pend"], weight: 60 },
];

const dateCandidates = [
  "prazo",
  "alvara_sanitario_validade",
  "data_val",
  "vencimento",
  "sla",
  "sla_due_at",
  "data_vencimento",
];

const hasMeaningfulValue = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return false;
  return text !== "—" && text !== "-";
};

const parseDate = (value) => {
  if (!value) return null;
  const text = normalizeText(value).trim();
  if (!text) return null;
  const parsed = dayjs(text, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (parsed.isValid()) return parsed.startOf("day");
  const fallback = dayjs(text);
  return fallback.isValid() ? fallback.startOf("day") : null;
};

const resolveDueDate = (proc) => {
  for (const key of dateCandidates) {
    const parsed = parseDate(proc?.[key]);
    if (parsed) return parsed;
  }
  return null;
};

const isAwaitingPayment = (statusKey) =>
  statusKey.includes("pag") && (statusKey.includes("aguard") || statusKey.includes("nao_p") || statusKey.includes("nao p"));

const isInAnalysis = (statusKey) => statusKey.includes("analise") || statusKey.includes("anal");

const calcStatusWeight = (statusKey) => {
  if (!statusKey) return 0;
  if (isProcessStatusInactive(statusKey)) return -120;

  let score = 0;
  for (const rule of STATUS_WEIGHT_RULES) {
    if (rule.keywords.every((token) => statusKey.includes(token))) {
      score = Math.max(score, rule.weight);
    }
  }
  return score;
};

const normalizeTypeKey = (value) =>
  removeDiacritics(normalizeText(value))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

export const getProcessUrgency = (proc) => {
  const typeKey = normalizeTypeKey(proc?.tipoKey || proc?.tipoBase || proc?.tipo);
  const statusKey = getStatusKey(proc?.situacao ?? proc?.status);
  const today = dayjs().startOf("day");
  const dueDate = resolveDueDate(proc);
  const daysToDue = dueDate ? dueDate.diff(today, "day") : null;

  const missingProtocol = !hasMeaningfulValue(proc?.protocolo);
  const missingPriorityField = getPriorityTypeFields(proc, 5).some((field) => field.isMissing);
  const incompleteData = missingProtocol || missingPriorityField;
  const overdue = daysToDue !== null && daysToDue < 0;
  const dueSoon = daysToDue !== null && daysToDue >= 0 && daysToDue <= 7;
  const awaitingPayment = isAwaitingPayment(statusKey);
  const inAnalysis = isInAnalysis(statusKey);

  let score = TYPE_WEIGHT[typeKey] ?? 60;
  score += calcStatusWeight(statusKey);
  if (overdue) score += 220;
  if (dueSoon) score += 120 - daysToDue * 5;
  if (awaitingPayment) score += 130;
  if (inAnalysis) score += 80;
  if (incompleteData) score += 90;
  if (isProcessStatusInactive(statusKey)) score -= 220;

  const buckets = [];
  if (overdue) buckets.push("overdue");
  if (dueSoon) buckets.push("due7");
  if (awaitingPayment) buckets.push("awaiting_payment");
  if (inAnalysis) buckets.push("in_analysis");
  if (incompleteData) buckets.push("incomplete");

  return {
    score,
    dueDate,
    daysToDue,
    buckets,
    overdue,
    dueSoon,
    awaitingPayment,
    inAnalysis,
    incompleteData,
  };
};

export const URGENCY_BUCKETS = [
  { key: "all", label: "Todos urgentes" },
  { key: "overdue", label: "Vencidos / fora do prazo" },
  { key: "due7", label: "Vence em até 7 dias" },
  { key: "awaiting_payment", label: "Aguardando pagamento" },
  { key: "in_analysis", label: "Em análise" },
  { key: "incomplete", label: "Sem protocolo / dados incompletos" },
];

