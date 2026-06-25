import { useCallback } from "react";

export default function useProcessRailFilters({
  setCompanyStatusFilters,
  setRiskFilters,
  setCertFilters,
  setMunicipioFilters,
  setUrgencyMin,
  setUrgencyMax,
  riskOptions,
  certOptions,
}) {
  const toggleArrayFilter = useCallback((value, values, setValues, allValues) => {
    setValues((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        const next = prev.filter((item) => item !== value);
        return next.length > 0 ? next : [value];
      }
      const next = [...prev, value];
      return allValues.every((item) => next.includes(item)) ? [...allValues] : next;
    });
  }, []);

  const toggleCompanyStatusFilter = useCallback((value) => {
    setCompanyStatusFilters((prev) => {
      if (value === "Todas") return ["Todas"];
      const base = prev.includes("Todas") ? [] : prev;
      const exists = base.includes(value);
      const next = exists ? base.filter((item) => item !== value) : [...base, value];
      return next.length > 0 ? next : ["Todas"];
    });
  }, [setCompanyStatusFilters]);

  const clearRailFilters = useCallback(() => {
    setCompanyStatusFilters(["Todas"]);
    setRiskFilters(riskOptions.map((item) => item.key));
    setCertFilters(certOptions.map((item) => item.key));
    setMunicipioFilters([]);
    setUrgencyMin(0);
    setUrgencyMax(100);
  }, [
    certOptions,
    riskOptions,
    setCertFilters,
    setCompanyStatusFilters,
    setMunicipioFilters,
    setRiskFilters,
    setUrgencyMax,
    setUrgencyMin,
  ]);

  return {
    toggleArrayFilter,
    toggleCompanyStatusFilter,
    clearRailFilters,
  };
}

