import React from "react";
import { getStatusKey } from "@/lib/domain/status/common";

const ALL_RISK_FILTERS = ["high", "medium", "low", "unmapped"];
const ALL_CERT_FILTERS = ["valido", "vencendo", "vencido", "sem_certificado"];
const RISK_PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 3, UNMAPPED: 4 };
const BASE_SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "nome", label: "Empresa" },
  { value: "status", label: "Status" },
  { value: "risco", label: "Risco" },
];
const KPI_ITEMS = [
  { key: "debitos", label: "Com d\u00e9bitos" },
  { key: "semCertificado", label: "Sem certificado" },
  { key: "taxasPendentes", label: "Taxas pendentes" },
  { key: "licencasVencendo", label: "Licen\u00e7as vencendo" },
  { key: "processosAndamento", label: "Processos em andamento" },
  { key: "criticos7dias", label: "Cr\u00edticos (<=7 dias)" },
];

const compareNullableScore = (a, b, direction) => {
  const an = Number.isFinite(a) ? a : null;
  const bn = Number.isFinite(b) ? b : null;
  if (an === null && bn === null) return 0;
  if (an === null) return 1;
  if (bn === null) return -1;
  return (an - bn) * (direction === "asc" ? 1 : -1);
};

export default function useCompanyFilters({
  rows,
  isCompanyActive,
  resolveCompanyStatus,
}) {
  const [kpiFilter, setKpiFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ativas");
  const [riskFilters, setRiskFilters] = React.useState([...ALL_RISK_FILTERS]);
  const [certFilters, setCertFilters] = React.useState([...ALL_CERT_FILTERS]);
  const [municipioFilters, setMunicipioFilters] = React.useState([]);
  const [urgencyMin, setUrgencyMin] = React.useState(0);
  const [urgencyMax, setUrgencyMax] = React.useState(100);
  const [porteFilters, setPorteFilters] = React.useState([]);
  const [responsavelFilters, setResponsavelFilters] = React.useState([]);
  const [sortBy, setSortBy] = React.useState({ field: "nome", direction: "asc" });

  const counts = React.useMemo(
    () => Object.fromEntries(KPI_ITEMS.map((item) => [item.key, rows.filter((row) => row.flags[item.key]).length])),
    [rows],
  );

  const summary = React.useMemo(() => {
    const activeCompanies = rows.filter((row) => isCompanyActive(row.empresa)).length;
    const highRisk = rows.filter((row) => row.riscoConsolidado === "HIGH").length;
    const scoreRows = rows.filter((row) => Number.isFinite(row.scoreUrgencia));
    const avgScore = scoreRows.length > 0
      ? Math.round(scoreRows.reduce((acc, row) => acc + Number(row.scoreUrgencia || 0), 0) / scoreRows.length)
      : null;

    return {
      totalCompanies: rows.length,
      activeCompanies,
      inactiveCompanies: rows.length - activeCompanies,
      highRisk,
      highRiskPercent: rows.length ? Math.round((highRisk / rows.length) * 100) : 0,
      avgScore,
      scoredCompanies: scoreRows.length,
    };
  }, [isCompanyActive, rows]);

  const municipioOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.municipioNormalized).filter((item) => item && item !== "-"))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const porteOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.porte).filter((item) => item && item !== "-"))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const responsavelOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.responsavelFiscal).filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, 12),
    [rows],
  );
  const sortOptions = React.useMemo(() => {
    const options = [...BASE_SORT_OPTIONS];
    if (municipioOptions.length > 1) options.push({ value: "municipio", label: "Munic\u00edpio" });
    if (porteOptions.length > 1) options.push({ value: "porte", label: "Porte" });
    return options;
  }, [municipioOptions.length, porteOptions.length]);

  const filteredRows = React.useMemo(() => {
    const list = rows.filter((row) => {
      if (kpiFilter && !row.flags[kpiFilter]) return false;
      const active = isCompanyActive(row.empresa);
      if (statusFilter === "ativas" && !active) return false;
      if (statusFilter === "inativas" && active) return false;
      if (!riskFilters.includes(row.riscoConsolidado)) return false;
      if (!certFilters.includes(row.certBucket)) return false;
      if (municipioFilters.length > 0 && !municipioFilters.includes(row.municipioNormalized)) return false;
      if (porteFilters.length > 0 && !porteFilters.includes(row.porte)) return false;
      if (responsavelFilters.length > 0 && !responsavelFilters.includes(row.responsavelFiscal)) return false;
      if (Number.isFinite(row.scoreUrgencia) && (row.scoreUrgencia < urgencyMin || row.scoreUrgencia > urgencyMax)) return false;
      return true;
    });

    const compareByField = (field, a, b) => {
      if (field === "score") return compareNullableScore(a.scoreUrgencia, b.scoreUrgencia, sortBy.direction);
      if (field === "risco") {
        const av = RISK_PRIORITY[a.riscoConsolidado] || 0;
        const bv = RISK_PRIORITY[b.riscoConsolidado] || 0;
        return (av - bv) * (sortBy.direction === "asc" ? 1 : -1);
      }
      if (field === "status") {
        const av = getStatusKey(resolveCompanyStatus(a.empresa) || "");
        const bv = getStatusKey(resolveCompanyStatus(b.empresa) || "");
        return av.localeCompare(bv) * (sortBy.direction === "asc" ? 1 : -1);
      }
      if (field === "municipio") {
        return String(a.municipioNormalized).localeCompare(String(b.municipioNormalized)) * (sortBy.direction === "asc" ? 1 : -1);
      }
      if (field === "porte") {
        return String(a.porte).localeCompare(String(b.porte)) * (sortBy.direction === "asc" ? 1 : -1);
      }
      return String(a.empresa?.empresa || "").toLowerCase().localeCompare(String(b.empresa?.empresa || "").toLowerCase()) * (sortBy.direction === "asc" ? 1 : -1);
    };

    list.sort((a, b) => compareByField(sortBy.field, a, b));
    return list;
  }, [
    certFilters,
    isCompanyActive,
    kpiFilter,
    municipioFilters,
    porteFilters,
    resolveCompanyStatus,
    responsavelFilters,
    riskFilters,
    rows,
    sortBy.direction,
    sortBy.field,
    statusFilter,
    urgencyMax,
    urgencyMin,
  ]);

  const toggleMultiFilter = React.useCallback((setter, value) => {
    setter((prev) => {
      const exists = prev.includes(value);
      return exists ? prev.filter((entry) => entry !== value) : [...prev, value];
    });
  }, []);

  const handleRiskFilterClick = React.useCallback((value) => {
    setRiskFilters((prev) => {
      if (prev.length > 1) return [value];
      if (prev[0] === value) return [...ALL_RISK_FILTERS];
      return [value];
    });
  }, []);

  const setSortField = React.useCallback((field) => {
    setSortBy((prev) => (
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: field === "score" ? "desc" : "asc" }
    ));
  }, []);

  const toggleSortDirection = React.useCallback(() => {
    setSortBy((prev) => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }));
  }, []);

  const handleScoreSortQuickToggle = React.useCallback(() => {
    setSortBy((prev) => {
      if (prev.field === "score") return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { field: "score", direction: "desc" };
    });
  }, []);

  const clearRailFilters = React.useCallback(() => {
    setStatusFilter("ativas");
    setRiskFilters([...ALL_RISK_FILTERS]);
    setCertFilters([...ALL_CERT_FILTERS]);
    setMunicipioFilters([]);
    setUrgencyMin(0);
    setUrgencyMax(100);
    setPorteFilters([]);
    setResponsavelFilters([]);
    setKpiFilter(null);
  }, []);

  const activeFilterBadges = React.useMemo(() => {
    const list = [];
    if (statusFilter !== "ativas") list.push({ key: "status", label: `Status: ${statusFilter}`, onClear: () => setStatusFilter("ativas") });
    if (riskFilters.length !== ALL_RISK_FILTERS.length) list.push({ key: "risco", label: `Risco: ${riskFilters.length}`, onClear: () => setRiskFilters([...ALL_RISK_FILTERS]) });
    if (certFilters.length !== ALL_CERT_FILTERS.length) list.push({ key: "cert", label: `Certificado: ${certFilters.length}`, onClear: () => setCertFilters([...ALL_CERT_FILTERS]) });
    if (municipioFilters.length > 0) list.push({ key: "municipio", label: `Munic\u00edpio: ${municipioFilters.length}`, onClear: () => setMunicipioFilters([]) });
    if (porteFilters.length > 0) list.push({ key: "porte", label: `Porte: ${porteFilters.length}`, onClear: () => setPorteFilters([]) });
    if (responsavelFilters.length > 0) list.push({ key: "responsavel", label: `Respons\u00e1vel fiscal: ${responsavelFilters.length}`, onClear: () => setResponsavelFilters([]) });
    if (urgencyMin > 0 || urgencyMax < 100) list.push({ key: "score", label: `Score: ${urgencyMin}-${urgencyMax}`, onClear: () => { setUrgencyMin(0); setUrgencyMax(100); } });
    if (kpiFilter) list.push({ key: "kpi", label: `KPI: ${kpiFilter}`, onClear: () => setKpiFilter(null) });
    return list;
  }, [certFilters.length, kpiFilter, municipioFilters.length, porteFilters.length, responsavelFilters.length, riskFilters.length, statusFilter, urgencyMax, urgencyMin]);

  return {
    kpis: KPI_ITEMS,
    counts,
    summary,
    filteredRows,
    municipioOptions,
    porteOptions,
    responsavelOptions,
    sortOptions,
    activeFilterBadges,
    kpiFilter,
    setKpiFilter,
    statusFilter,
    setStatusFilter,
    riskFilters,
    setRiskFilters,
    certFilters,
    setCertFilters,
    municipioFilters,
    setMunicipioFilters,
    urgencyMin,
    setUrgencyMin,
    urgencyMax,
    setUrgencyMax,
    porteFilters,
    setPorteFilters,
    responsavelFilters,
    setResponsavelFilters,
    sortBy,
    clearRailFilters,
    toggleMultiFilter,
    handleRiskFilterClick,
    setSortField,
    toggleSortDirection,
    handleScoreSortQuickToggle,
    allRiskFilters: ALL_RISK_FILTERS,
    allCertFilters: ALL_CERT_FILTERS,
  };
}
