import { useMemo } from "react";
import { formatMunicipio } from "@/lib/domain/adapters/processos";

export default function useProcessRailResult({
  processosPorTipo,
  companyStatusFilters,
  riskFilters,
  certFilters,
  municipioFilters,
  urgencyMin,
  urgencyMax,
}) {
  return useMemo(() => {
    return processosPorTipo.filter((proc) => {
      if (!companyStatusFilters.includes("Todas") && !companyStatusFilters.includes(proc.companyStatus || "Todas")) return false;
      if (!riskFilters.includes(proc.companyRisk || "unmapped")) return false;
      if (!certFilters.includes(proc.certBucket || "sem_certificado")) return false;
      const municipioLabel = formatMunicipio(proc);
      if (municipioFilters.length > 0 && !municipioFilters.includes(municipioLabel)) return false;
      if (Number.isFinite(proc.urgencyScore)) {
        if (proc.urgencyScore < urgencyMin || proc.urgencyScore > urgencyMax) return false;
      }
      return true;
    });
  }, [certFilters, companyStatusFilters, municipioFilters, processosPorTipo, riskFilters, urgencyMax, urgencyMin]);
}
