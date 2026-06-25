import { useMemo } from "react";

export default function useProcessTypeGroups(processosEnriquecidos) {
  return useMemo(() => {
    const groups = new Map();
    processosEnriquecidos.forEach((proc) => {
      const entry = groups.get(proc.tipoKey) || {
        key: proc.tipoKey,
        display: proc.tipoDisplay,
        count: 0,
      };
      entry.count += 1;
      groups.set(proc.tipoKey, entry);
    });

    return [
      { key: "TODOS", display: "Todos", count: processosEnriquecidos.length },
      ...Array.from(groups.values()).sort((a, b) => a.display.localeCompare(b.display)),
    ];
  }, [processosEnriquecidos]);
}
