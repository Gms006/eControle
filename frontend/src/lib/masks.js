export {
  maskCnpj,
  maskCpf,
  maskPhone,
  normalizeDigits,
} from "./format/documents.js";

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
