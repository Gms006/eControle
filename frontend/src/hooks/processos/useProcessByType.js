import { useMemo } from "react";

export default function useProcessByType(processosEnriquecidos, selectedTipo) {
  return useMemo(
    () =>
      selectedTipo === "TODOS"
        ? processosEnriquecidos
        : processosEnriquecidos.filter((proc) => proc.tipoKey === selectedTipo),
    [processosEnriquecidos, selectedTipo],
  );
}
