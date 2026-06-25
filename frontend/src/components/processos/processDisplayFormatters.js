import dayjs from "dayjs";
import { formatStatusDisplay } from "@/lib/domain/status/display";
import { getStatusKey } from "@/lib/domain/status/common";

const PROCESS_STATUS_ABBREVIATIONS = {
  aguardando_documento: "Ag. documento",
  aguardando_vistoria: "Ag. vistoria",
  aguardando_pagamento: "Ag. pagamento",
  aguardando_regularizacao: "Ag. regularização",
  aguardando_liberacao: "Ag. liberação",
  em_analise: "Em análise",
};

export const formatProcessDateTime = (value) => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY HH:mm");
};

export const abbreviateProcessStatus = (rawStatus) => {
  const key = getStatusKey(rawStatus);
  const formatted = formatStatusDisplay(rawStatus);
  const base = PROCESS_STATUS_ABBREVIATIONS[key] || formatted;
  if (base.length <= 22) return base;
  return `${base.slice(0, 21)}…`;
};
