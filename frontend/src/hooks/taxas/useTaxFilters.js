import React from "react";

export default function useTaxFilters({
  taxasGlobais,
  municipio,
  query,
  alertFilterActive,
  modoFoco,
  defaultRiskKeys,
  defaultCertBuckets,
  riskOptions,
  certOptions,
  statusFilterOptions,
  workQueueItems,
  tipoKeys,
  matchLocalSearch,
  getResumoBucket,
  matchesQueueFilter,
  parseSortableDate,
  getDataEnvioDisplay,
}) {
  const [queueFilter, setQueueFilter] = React.useState("all");
  const [sortEmpresas, setSortEmpresas] = React.useState({ field: "empresa", direction: "asc" });
  const [viewMode, setViewMode] = React.useState("table");
  const [localSearch, setLocalSearch] = React.useState("");
  const [summaryFilter, setSummaryFilter] = React.useState("all");
  const [railFilters, setRailFilters] = React.useState({
    companyStatus: "Ativas",
    riskKeys: [...defaultRiskKeys],
    certBuckets: [...defaultCertBuckets],
    municipio: [],
    urgencyMin: 0,
    urgencyMax: 100,
  });

  const municipioOptions = React.useMemo(
    () =>
      Array.from(new Set(taxasGlobais.map((taxa) => String(taxa?.municipio || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
      ),
    [taxasGlobais],
  );

  const railScopedTaxas = React.useMemo(
    () =>
      taxasGlobais.filter((taxa) => {
        if (railFilters.companyStatus !== "Todas" && taxa.__companyStatusKey !== railFilters.companyStatus) return false;
        if (!railFilters.riskKeys.includes(taxa.__riskKey)) return false;
        if (!railFilters.certBuckets.includes(taxa.__certBucket)) return false;
        if (railFilters.municipio.length > 0 && !railFilters.municipio.includes(String(taxa?.municipio || "").trim())) return false;
        if (taxa.__urgencyScore < railFilters.urgencyMin || taxa.__urgencyScore > railFilters.urgencyMax) return false;
        return true;
      }),
    [railFilters, taxasGlobais],
  );

  const localSearchScoped = React.useMemo(
    () => railScopedTaxas.filter((taxa) => matchLocalSearch(taxa, localSearch)),
    [localSearch, matchLocalSearch, railScopedTaxas],
  );

  const summaryScoped = React.useMemo(
    () => (summaryFilter === "all" ? localSearchScoped : localSearchScoped.filter((taxa) => getResumoBucket(taxa) === summaryFilter)),
    [getResumoBucket, localSearchScoped, summaryFilter],
  );

  const queueCounts = React.useMemo(
    () =>
      Object.fromEntries(
        workQueueItems
          .filter((item) => item.key !== "all")
          .map((item) => [item.key, localSearchScoped.filter((taxa) => matchesQueueFilter(taxa, item.key, tipoKeys)).length]),
      ),
    [localSearchScoped, matchesQueueFilter, tipoKeys, workQueueItems],
  );

  const taxasVisiveis = React.useMemo(
    () => summaryScoped.filter((taxa) => matchesQueueFilter(taxa, queueFilter, tipoKeys)),
    [matchesQueueFilter, queueFilter, summaryScoped, tipoKeys],
  );

  const resumoCards = React.useMemo(() => {
    const source = localSearchScoped;
    return {
      total: source.length,
      em_dia: source.filter((taxa) => getResumoBucket(taxa) === "em_dia").length,
      pendente: source.filter((taxa) => getResumoBucket(taxa) === "pendente").length,
      irregular: source.filter((taxa) => getResumoBucket(taxa) === "irregular").length,
    };
  }, [getResumoBucket, localSearchScoped]);

  const taxasVisiveisOrdenadas = React.useMemo(() => {
    const list = [...taxasVisiveis];
    const factor = sortEmpresas.direction === "desc" ? -1 : 1;
    list.sort((a, b) => {
      if (sortEmpresas.field === "data_envio") {
        const av = parseSortableDate(getDataEnvioDisplay(a?.data_envio).date) ?? 0;
        const bv = parseSortableDate(getDataEnvioDisplay(b?.data_envio).date) ?? 0;
        if (av === bv) return 0;
        return (av - bv) * factor;
      }
      if (sortEmpresas.field === "status_geral") {
        return getResumoBucket(a).localeCompare(getResumoBucket(b), "pt-BR", { sensitivity: "base" }) * factor;
      }
      const av = String(a?.[sortEmpresas.field] || "").trim();
      const bv = String(b?.[sortEmpresas.field] || "").trim();
      return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * factor;
    });
    return list;
  }, [getDataEnvioDisplay, getResumoBucket, parseSortableDate, sortEmpresas.direction, sortEmpresas.field, taxasVisiveis]);

  const activeFilterChips = React.useMemo(() => {
    const chips = [];
    if (municipio && municipio !== "Todos") chips.push(`Munic\u00edpio: ${municipio}`);
    if (query.trim()) chips.push(`Busca global: ${query.trim()}`);
    if (alertFilterActive) chips.push("Somente alertas");
    if (modoFoco) chips.push("Modo foco");
    if (railFilters.companyStatus !== "Ativas") chips.push(`Status da empresa: ${railFilters.companyStatus}`);
    if (railFilters.riskKeys.length !== defaultRiskKeys.length) {
      chips.push(`Risco CNAE: ${railFilters.riskKeys.map((key) => riskOptions.find((option) => option.key === key)?.label || key).join(", ")}`);
    }
    if (railFilters.certBuckets.length !== defaultCertBuckets.length) {
      chips.push(`Certificado: ${railFilters.certBuckets.map((key) => certOptions.find((option) => option.key === key)?.label || key).join(", ")}`);
    }
    if (railFilters.municipio.length > 0) chips.push(`Munic\u00edpio local: ${railFilters.municipio.join(", ")}`);
    if (railFilters.urgencyMin !== 0 || railFilters.urgencyMax !== 100) chips.push(`Score de urg\u00eancia: ${railFilters.urgencyMin}-${railFilters.urgencyMax}`);
    if (localSearch.trim()) chips.push(`Busca local: ${localSearch.trim()}`);
    if (summaryFilter !== "all") {
      const option = statusFilterOptions.find((item) => item.value === summaryFilter);
      if (option) chips.push(`Status: ${option.label}`);
    }
    if (queueFilter !== "all") {
      const option = workQueueItems.find((item) => item.key === queueFilter);
      if (option) chips.push(`Fila: ${option.label}`);
    }
    if (viewMode === "cards") chips.push("Visualiza\u00e7\u00e3o: Cards");
    return chips;
  }, [
    alertFilterActive,
    certOptions,
    defaultCertBuckets.length,
    defaultRiskKeys.length,
    localSearch,
    modoFoco,
    municipio,
    query,
    queueFilter,
    railFilters,
    riskOptions,
    statusFilterOptions,
    summaryFilter,
    viewMode,
    workQueueItems,
  ]);

  const railActiveCount = React.useMemo(() => {
    let count = 0;
    if (railFilters.companyStatus !== "Ativas") count += 1;
    if (railFilters.riskKeys.length !== defaultRiskKeys.length) count += 1;
    if (railFilters.certBuckets.length !== defaultCertBuckets.length) count += 1;
    if (railFilters.municipio.length > 0) count += 1;
    if (railFilters.urgencyMin > 0 || railFilters.urgencyMax < 100) count += 1;
    return count;
  }, [defaultCertBuckets.length, defaultRiskKeys.length, railFilters]);

  const clearRailFilters = React.useCallback(() => {
    setRailFilters({
      companyStatus: "Ativas",
      riskKeys: [...defaultRiskKeys],
      certBuckets: [...defaultCertBuckets],
      municipio: [],
      urgencyMin: 0,
      urgencyMax: 100,
    });
  }, [defaultCertBuckets, defaultRiskKeys]);

  const toggleRailFilter = React.useCallback((key, field, defaults) => {
    setRailFilters((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const next = current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
      return { ...prev, [field]: next.length ? next : [...defaults] };
    });
  }, []);

  const chipClass = React.useCallback(
    (active) => `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
    }`,
    [],
  );

  return {
    queueFilter,
    setQueueFilter,
    sortEmpresas,
    setSortEmpresas,
    viewMode,
    setViewMode,
    localSearch,
    setLocalSearch,
    summaryFilter,
    setSummaryFilter,
    railFilters,
    setRailFilters,
    municipioOptions,
    localSearchScoped,
    queueCounts,
    taxasVisiveisOrdenadas,
    resumoCards,
    activeFilterChips,
    railActiveCount,
    clearRailFilters,
    toggleRailFilter,
    chipClass,
  };
}
