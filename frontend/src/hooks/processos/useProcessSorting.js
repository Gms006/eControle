import { useCallback } from "react";

export default function useProcessSorting({
  sortOptions,
  sortField,
  setSortField,
  setSortDir,
}) {
  const resolveDefaultSortDir = useCallback(
    (field) => sortOptions.find((option) => option.value === field)?.defaultDir ?? "asc",
    [sortOptions],
  );

  const handleSortClick = useCallback((field, preferDefaultFirst = false) => {
    const defaultDir = resolveDefaultSortDir(field);
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(preferDefaultFirst ? defaultDir : "asc");
  }, [resolveDefaultSortDir, setSortDir, setSortField, sortField]);

  return {
    resolveDefaultSortDir,
    handleSortClick,
  };
}
