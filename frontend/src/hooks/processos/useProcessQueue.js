import { useMemo } from "react";

export default function useProcessQueue({
  processosRailFiltrados,
  isUrgentByStatus,
  urgencyBuckets,
  queueMode,
  selectedUrgencyBucket,
  sortField,
  sortDir,
  sortOptions,
  columnMetaMap,
  compareProcessos,
  defaultSort,
  secondarySort,
}) {
  const urgencyCounts = useMemo(() => {
    const counts = {
      all: processosRailFiltrados.filter((proc) => isUrgentByStatus(proc)).length,
    };
    urgencyBuckets.forEach((bucket) => {
      if (bucket.key === "all") return;
      counts[bucket.key] = processosRailFiltrados.filter((proc) =>
        isUrgentByStatus(proc) && proc.urgencyBuckets.includes(bucket.key),
      ).length;
    });
    return counts;
  }, [isUrgentByStatus, processosRailFiltrados, urgencyBuckets]);

  const processosFiltradosQueue = useMemo(() => {
    if (queueMode !== "urgent") return processosRailFiltrados;
    const urgentOnly = processosRailFiltrados.filter((proc) => isUrgentByStatus(proc));
    if (selectedUrgencyBucket === "all") return urgentOnly;
    return urgentOnly.filter((proc) => proc.urgencyBuckets.includes(selectedUrgencyBucket));
  }, [isUrgentByStatus, processosRailFiltrados, queueMode, selectedUrgencyBucket]);

  const processosOrdenados = useMemo(() => {
    const comparator = (a, b) => {
      const normalizedSortField = sortField === "urgencyScore" ? "urgencyScoreRaw" : sortField;
      const meta = sortOptions.find((option) => option.value === sortField) || columnMetaMap[sortField] || {};
      const primary = compareProcessos(a, b, normalizedSortField, sortDir, meta);
      if (primary !== 0) return primary;

      const byUrgency = compareProcessos(a, b, defaultSort.value, defaultSort.defaultDir, defaultSort);
      if (byUrgency !== 0) return byUrgency;

      const byDate = compareProcessos(a, b, secondarySort.value, secondarySort.defaultDir, secondarySort);
      if (byDate !== 0) return byDate;

      return compareProcessos(a, b, "empresa", "asc");
    };
    return [...processosFiltradosQueue].sort(comparator);
  }, [
    columnMetaMap,
    compareProcessos,
    defaultSort,
    processosFiltradosQueue,
    secondarySort,
    sortDir,
    sortField,
    sortOptions,
  ]);

  return {
    urgencyCounts,
    processosOrdenados,
  };
}
