import { useMemo } from "react";
import { formatMunicipio } from "@/lib/domain/adapters/processos";

export default function useProcessMunicipios(processosEnriquecidos) {
  return useMemo(() => {
    return Array.from(
      new Set(
        processosEnriquecidos
          .map((proc) => formatMunicipio(proc))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [processosEnriquecidos]);
}
