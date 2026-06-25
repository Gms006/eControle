import { normalizeText } from "@/lib/format/strings";

const NON_DIGIT_REGEX = /\D+/g;

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
  if (digits.length === 11) return formatCpf(digits);
  if (digits.length === 14) return formatCnpj(digits);
  return digits;
};

export const formatPhoneBr = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) return undefined;
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return digits;
};

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

export const maskCNPJ = (value) => {
  const formatted = formatCnpj(value);
  if (!formatted || formatted.length !== 18) return value ?? "\u2014";
  return formatted;
};
