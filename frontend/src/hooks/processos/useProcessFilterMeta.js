import { useMemo } from "react";

export default function useProcessFilterMeta({
  municipio,
  searchField,
  soAlertas,
  modoFoco,
  companyStatusFilters,
  riskFilters,
  certFilters,
  municipioFilters,
  urgencyMin,
  urgencyMax,
  riskOptionsLength,
  certOptionsLength,
}) {
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (municipio && municipio !== "Todos") chips.push(`Munic\u00edpio: ${municipio}`);
    if (searchField && searchField !== "all") {
      const labels = { nome: "Empresa", cnpj: "CNPJ", protocolo: "Protocolo" };
      chips.push(`Busca: ${labels[searchField] || searchField}`);
    }
    if (soAlertas) chips.push("Status: Alertas");
    if (modoFoco) chips.push("Status: Ativas");
    return chips;
  }, [modoFoco, municipio, searchField, soAlertas]);

  const railActiveCount = useMemo(() => {
    let count = 0;
    if (
      !(companyStatusFilters.length === 2 &&
        companyStatusFilters.includes("Ativas") &&
        companyStatusFilters.includes("Sem v\u00ednculo"))
    ) {
      count += 1;
    }
    if (riskFilters.length !== riskOptionsLength) count += 1;
    if (certFilters.length !== certOptionsLength) count += 1;
    if (municipioFilters.length > 0) count += 1;
    if (urgencyMin > 0 || urgencyMax < 100) count += 1;
    return count;
  }, [
    certFilters.length,
    certOptionsLength,
    companyStatusFilters,
    municipioFilters.length,
    riskFilters.length,
    riskOptionsLength,
    urgencyMax,
    urgencyMin,
  ]);

  return {
    activeFilterChips,
    railActiveCount,
  };
}
