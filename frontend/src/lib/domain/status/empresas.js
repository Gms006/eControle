import { resolveStatusMapEntry } from "@/lib/domain/status/common";

export const EMPRESA_RISCO_MAP = {
  high: { variant: "danger", label: "Alto" },
  medium: { variant: "warning", label: "M\u00e9dio" },
  low: { variant: "success", label: "Baixo" },
};

export const EMPRESA_STATUS_MAP = {
  ativo: { variant: "success", label: "Ativo" },
  ativa: { variant: "success", label: "Ativa" },
  inativo: { variant: "warning", label: "Inativo" },
  inativa: { variant: "warning", label: "Inativa" },
};

export const EMPRESA_SITUACAO_TAXAS_MAP = {
  regular: { variant: "success", label: "Regular" },
  irregular: { variant: "danger", label: "Irregular" },
};

export const EMPRESA_DEBITO_MAP = {
  sem_debitos: { variant: "success", label: "Sem d\u00e9bitos" },
  possui_debito: { variant: "danger", label: "Possui d\u00e9bito" },
};

export const resolveEmpresaRisco = (risco) => resolveStatusMapEntry(EMPRESA_RISCO_MAP, risco);
export const resolveEmpresaStatus = (status) => resolveStatusMapEntry(EMPRESA_STATUS_MAP, status);
export const resolveEmpresaSituacaoTaxas = (situacao) => resolveStatusMapEntry(EMPRESA_SITUACAO_TAXAS_MAP, situacao);
export const resolveEmpresaDebito = (debito) => resolveStatusMapEntry(EMPRESA_DEBITO_MAP, debito);
