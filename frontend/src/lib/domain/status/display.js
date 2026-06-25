import { formatCanonicalLabel, normalizeText } from "@/lib/text";
import { deriveStatusFromInstallment, formatInstallment, parseInstallment } from "@/lib/installment";
import {
  EMPTY_STATUS_LABEL,
  canonicalStatusCandidates,
} from "@/lib/domain/status/common";
import { CERTIFICADO_STATUS_MAP } from "@/lib/domain/status/certificados";
import {
  EMPRESA_DEBITO_MAP,
  EMPRESA_RISCO_MAP,
  EMPRESA_SITUACAO_TAXAS_MAP,
  EMPRESA_STATUS_MAP,
} from "@/lib/domain/status/empresas";
import {
  LICENCA_STATUS_MAP,
  LICENCA_TIPO_MAP,
  NAO_EXIGIDO_MOTIVO_MAP,
  resolveLicencaTipo,
} from "@/lib/domain/status/licencas";
import {
  PROCESSO_ALVARA_MAP,
  PROCESSO_NOTIFICACAO_MAP,
  PROCESSO_OPERACAO_MAP,
  PROCESSO_ORGAO_MAP,
  PROCESSO_SERVICO_MAP,
  PROCESSO_STATUS_MAP,
  PROCESSO_TIPO_MAP,
  PROCESSO_URGENCIA_MAP,
  resolveProcessoTipo,
} from "@/lib/domain/status/processos";
import {
  TAXA_STATUS_EDICAO_MAP,
  TAXA_STATUS_FILA_MAP,
  TAXA_STATUS_GERAL_MAP,
  TAXA_TIPO_MAP,
  resolveTaxaTipo,
} from "@/lib/domain/status/taxas";

const STATUS_VARIANT_MAPS = [
  PROCESSO_STATUS_MAP,
  LICENCA_STATUS_MAP,
  TAXA_STATUS_EDICAO_MAP,
  TAXA_STATUS_FILA_MAP,
  TAXA_STATUS_GERAL_MAP,
  CERTIFICADO_STATUS_MAP,
];

const STATUS_LABEL_MAPS = [
  ...STATUS_VARIANT_MAPS,
  LICENCA_TIPO_MAP,
  PROCESSO_TIPO_MAP,
  TAXA_TIPO_MAP,
  EMPRESA_STATUS_MAP,
  EMPRESA_SITUACAO_TAXAS_MAP,
  EMPRESA_DEBITO_MAP,
  EMPRESA_RISCO_MAP,
  PROCESSO_URGENCIA_MAP,
  PROCESSO_OPERACAO_MAP,
  PROCESSO_ORGAO_MAP,
  PROCESSO_ALVARA_MAP,
  PROCESSO_SERVICO_MAP,
  PROCESSO_NOTIFICACAO_MAP,
  NAO_EXIGIDO_MOTIVO_MAP,
];

export const resolveStatusClass = (status) => {
  const normalized = normalizeText(status).trim();
  if (!normalized || normalized === "*" || normalized === "-" || normalized === EMPTY_STATUS_LABEL) {
    return { variant: "outline" };
  }

  const installment = parseInstallment(normalized);
  if (installment) {
    const derived = deriveStatusFromInstallment(installment.paid, installment.total);
    return { variant: derived === "paid" ? "success" : "warning" };
  }

  const candidates = canonicalStatusCandidates(normalized);
  for (const map of STATUS_VARIANT_MAPS) {
    for (const candidate of candidates) {
      if (map[candidate]) return { variant: map[candidate].variant };
    }
  }

  const key = candidates[0] || "";
  if (key.includes("regular") && !key.includes("irregular")) return { variant: "success" };
  if (key.includes("irregular")) return { variant: "danger" };
  if (key.includes("venc")) return { variant: "warning" };
  if (key.includes("pago") && !key.includes("nao")) return { variant: "success" };
  if (key.includes("nao_pago") || key.includes("em_aberto")) return { variant: "danger" };
  if (key.includes("ativo")) return { variant: "success" };
  if (key.includes("inativo")) return { variant: "warning" };
  return { variant: "neutral" };
};

export const formatStatusDisplay = (status) => {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  if (!trimmed || trimmed === "*" || trimmed === "-" || trimmed === EMPTY_STATUS_LABEL) return EMPTY_STATUS_LABEL;

  const installment = parseInstallment(trimmed);
  if (installment) {
    const derived = deriveStatusFromInstallment(installment.paid, installment.total);
    if (derived === "paid") return "Pago";
    return `Parcelado ${formatInstallment(installment.paid, installment.total)}`;
  }

  const trailingDateMatch = trimmed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\s*$/);
  const trailingDate = trailingDateMatch
    ? `${String(trailingDateMatch[1]).padStart(2, "0")}/${String(trailingDateMatch[2]).padStart(2, "0")}/${String(
        trailingDateMatch[3],
      ).length === 2 ? `20${trailingDateMatch[3]}` : trailingDateMatch[3]}`
    : null;

  if (!trailingDate && /\s[-\u2013]\s/.test(trimmed)) return trimmed;

  const candidates = canonicalStatusCandidates(trimmed);
  for (const map of STATUS_LABEL_MAPS) {
    for (const candidate of candidates) {
      if (map[candidate]) {
        return trailingDate ? `${map[candidate].label} - ${trailingDate}` : map[candidate].label;
      }
    }
  }

  return String(trimmed).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatTechnicalStatusLabel = (value) => formatStatusDisplay(value);

export const formatProcessTypeLabel = (value) => {
  const resolved = resolveProcessoTipo(value);
  return resolved?.label || formatCanonicalLabel(value);
};

export const formatLicenceTypeLabel = (value) => {
  const resolved = resolveLicencaTipo(value);
  return resolved?.label || formatCanonicalLabel(value);
};

export const formatTaxTypeLabel = (value) => {
  const resolved = resolveTaxaTipo(value);
  return resolved?.label || formatCanonicalLabel(value);
};
