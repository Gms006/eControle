import { resolveStatusMapEntry, withStatusAliases } from "@/lib/domain/status/common";

export const CERTIFICADO_STATUS_MAP = withStatusAliases(
  {
    valido: { variant: "success", label: "V\u00e1lido" },
    vence_dentro_de_7_dias: { variant: "warning", label: "Vence em 7 dias" },
    vence_dentro_de_30_dias: { variant: "warning", label: "Vence em 30 dias" },
    vencido: { variant: "danger", label: "Vencido" },
    nao_possui: { variant: "neutral", label: "N\u00e3o possui" },
  },
  {
    "v\u00e1lido": "valido",
    ok: "valido",
    alerta: "vence_dentro_de_7_dias",
    vencendo: "vence_dentro_de_7_dias",
  },
);

export const resolveCertificadoStatus = (status) => resolveStatusMapEntry(CERTIFICADO_STATUS_MAP, status);

export const resolveCertificadoDias = (diasRestantes) => {
  if (diasRestantes == null) return { variant: "neutral" };
  const days = Number(diasRestantes);
  if (!Number.isFinite(days)) return { variant: "neutral" };
  if (days < 0) return { variant: "danger" };
  if (days <= 30) return { variant: "warning" };
  return { variant: "success" };
};
