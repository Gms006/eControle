import {
  formatCnpj,
  formatCpf,
  formatPhoneBr,
  normalizeDocumentDigits,
} from "@/lib/text";

export const normalizeDigits = (value) => normalizeDocumentDigits(value) || "";

export const maskCnpj = (value) => {
  const digits = normalizeDigits(value).slice(0, 14);
  return formatCnpj(digits) || digits;
};

export const maskCpf = (value) => {
  const digits = normalizeDigits(value).slice(0, 11);
  return formatCpf(digits) || digits;
};

export const maskPhone = (value) => {
  const digits = normalizeDigits(value).slice(0, 11);
  return formatPhoneBr(digits) || digits;
};

export const normalizeFsDirname = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

export const hasInvalidFsDirname = (value) => {
  const text = String(value || "").trim();
  return /\.\.|[/:\\]/.test(text);
};

export const normalizePorteSigla = (value) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "");

  if (!raw) return "";
  if (raw.includes("MEI")) return "MEI";
  if (raw === "MICROEMPRESA" || raw === "ME") return "ME";
  if (raw === "EMPRESA DE PEQUENO PORTE" || raw === "EPP") return "EPP";
  if (raw === "DEMAIS" || raw === "NORMAL") return "DEMAIS";

  return raw;
};