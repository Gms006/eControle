const INSTALLMENT_RE = /^\s*(\d+)\s*[/ ]\s*(\d+)\s*$/;

export function parseInstallment(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  const match = text.match(INSTALLMENT_RE);
  if (!match) return null;
  const paid = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(paid) || !Number.isInteger(total)) return null;
  if (total <= 0) return null;
  if (paid < 0 || paid > total) return null;
  return { paid, total };
}

export function formatInstallment(paid, total) {
  return `${Number(paid)}/${Number(total)}`;
}

export function deriveStatusFromInstallment(paid, total) {
  return Number(paid) >= Number(total) ? "paid" : "installment";
}

export function normalizeInstallmentInput(input) {
  const text = String(input ?? "");
  if (!text.trim()) return "";
  const compact = text.replace(/\s+/g, " ").trim();
  const match = compact.match(/^(\d+)\s*[/ ]\s*(\d+)$/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  const partialSlash = compact.match(/^(\d+)\s*\/\s*$/);
  if (partialSlash) {
    return `${partialSlash[1]}/`;
  }
  const slashOnly = compact.match(/^\/$/);
  if (slashOnly) {
    return "/";
  }
  return compact;
}

export function validateInstallmentInput(input) {
  const text = String(input ?? "").trim();
  if (!text) return "Informe as parcelas no formato x/y.";
  const parsed = parseInstallment(text);
  if (!parsed) return "Formato inválido. Use x/y com y > 0 e 0 <= x <= y.";
  return "";
}

export function isInstallmentInProgress(status) {
  const parsed = parseInstallment(status);
  if (!parsed) return false;
  return deriveStatusFromInstallment(parsed.paid, parsed.total) === "installment";
}
