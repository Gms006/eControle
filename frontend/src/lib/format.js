import { formatCnpj } from "@/lib/text";

export function maskCNPJ(value) {
  const formatted = formatCnpj(value);
  if (!formatted || formatted.length !== 18) return value ?? "—";
  return formatted;
}
