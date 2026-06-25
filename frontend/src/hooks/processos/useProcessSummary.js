import { useMemo } from "react";
import { normalizeStatusKey } from "@/lib/domain/adapters/processos";

export default function useProcessSummary(processosEnriquecidos) {
  return useMemo(() => {
    return processosEnriquecidos.reduce(
      (acc, proc) => {
        const statusKey = normalizeStatusKey(proc?.situacao || proc?.status);
        acc.total += 1;
        if (
          statusKey.includes("em analise") ||
          statusKey.includes("em andamento") ||
          statusKey.includes("aguardando documento") ||
          statusKey.includes("aguardando vistoria")
        ) {
          acc.emAnalise += 1;
        }
        if (
          statusKey.includes("pendente") ||
          statusKey.includes("aguardando pagamento") ||
          statusKey.includes("aguardando regularizacao") ||
          statusKey.includes("aguardando liberacao")
        ) {
          acc.pendentes += 1;
        }
        if (
          statusKey.includes("deferido") ||
          statusKey.includes("concluido") ||
          statusKey.includes("licenciado")
        ) {
          acc.deferidos += 1;
        }
        return acc;
      },
      { total: 0, emAnalise: 0, pendentes: 0, deferidos: 0 },
    );
  }, [processosEnriquecidos]);
}
