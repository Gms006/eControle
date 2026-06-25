import React from "react";
import { isAlertStatus } from "@/lib/domain/status/common";
import { resolveLicencaTipo } from "@/lib/domain/status/licencas";

export default function useLicenceFilters({
  rows,
  groupConfig,
  sortOptions,
  defaultSort,
  tipos,
  scoreRiskOptions,
  scoreStatusOptions,
  formatStatusDisplay,
  formatStatusWithDate,
  formatSanitaryComplexityLabel,
}) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [quickMunicipio, setQuickMunicipio] = React.useState("todos");
  const [quickTipo, setQuickTipo] = React.useState("todos");
  const [quickStatus, setQuickStatus] = React.useState("todos");
  const [quickScoreRisk, setQuickScoreRisk] = React.useState("todos");
  const [quickScoreStatus, setQuickScoreStatus] = React.useState("todos");
  const [sortField, setSortField] = React.useState(defaultSort.value);
  const [sortDir, setSortDir] = React.useState(defaultSort.defaultDir);
  const [somenteAlertasLocal, setSomenteAlertasLocal] = React.useState(false);
  const [kpiFilter, setKpiFilter] = React.useState("todos");
  const [priorityGroup, setPriorityGroup] = React.useState("todos");
  const [railStatusFilter, setRailStatusFilter] = React.useState("ativas");
  const [railRiskFilters, setRailRiskFilters] = React.useState(["HIGH", "MEDIUM", "LOW", "UNMAPPED"]);
  const [railCertFilters, setRailCertFilters] = React.useState(["valido", "vencendo", "vencido", "sem_certificado"]);
  const [railMunicipioFilters, setRailMunicipioFilters] = React.useState([]);
  const [railSanitaryComplexityFilter, setRailSanitaryComplexityFilter] = React.useState("todas");
  const [railUrgencyMin, setRailUrgencyMin] = React.useState(0);
  const [railUrgencyMax, setRailUrgencyMax] = React.useState(100);

  const municipios = React.useMemo(
    () => ["todos", ...Array.from(new Set(rows.map((r) => r?.municipio).filter(Boolean)))],
    [rows],
  );

  const railMunicipioOptions = React.useMemo(
    () => Array.from(new Set(rows.map((item) => item?.municipio).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const railSanitaryComplexityOptions = React.useMemo(
    () =>
      Array.from(new Set(rows.map((item) => item?.sanitary_complexity).filter(Boolean))).sort((a, b) =>
        formatSanitaryComplexityLabel(a).localeCompare(formatSanitaryComplexityLabel(b), "pt-BR"),
      ),
    [formatSanitaryComplexityLabel, rows],
  );

  const filteredBase = React.useMemo(
    () =>
      rows.filter((item) => {
        if (railStatusFilter === "ativas" && item?.company_active === false) return false;
        if (railStatusFilter === "inativas" && item?.company_active !== false) return false;
        if (!railRiskFilters.includes(item?.risk_bucket || "UNMAPPED")) return false;
        if (!railCertFilters.includes(item?.cert_bucket || "sem_certificado")) return false;
        if (railMunicipioFilters.length > 0 && !railMunicipioFilters.includes(item?.municipio)) return false;
        if (
          railSanitaryComplexityFilter !== "todas" &&
          (item?.sanitary_complexity || "__none__") !== railSanitaryComplexityFilter
        ) {
          return false;
        }
        if (Number.isFinite(item?.score_urgencia)) {
          if (item.score_urgencia < railUrgencyMin || item.score_urgencia > railUrgencyMax) return false;
        } else if (railUrgencyMin > 0 || railUrgencyMax < 100) {
          return false;
        }

        if (searchTerm.trim()) {
          const token = searchTerm.trim().toLowerCase();
          const haystack = [
            item?.empresa_display,
            item?.cnpj,
            item?.municipio,
            resolveLicencaTipo(item?.tipo).label,
            formatStatusWithDate(item),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(token)) return false;
        }
        if (quickMunicipio !== "todos" && item?.municipio !== quickMunicipio) return false;
        if (quickTipo !== "todos" && item?.tipo_norm !== quickTipo) return false;
        if (quickStatus !== "todos" && item?.status_key_canonical !== quickStatus) return false;
        if (
          quickScoreRisk !== "todos" &&
          ((quickScoreRisk === "__none__" && item?.risco_consolidado) ||
            (quickScoreRisk !== "__none__" && item?.risco_consolidado !== quickScoreRisk))
        ) {
          return false;
        }
        if (
          quickScoreStatus !== "todos" &&
          ((quickScoreStatus === "__none__" && item?.score_status) ||
            (quickScoreStatus !== "__none__" && item?.score_status !== quickScoreStatus))
        ) {
          return false;
        }
        if (somenteAlertasLocal && !isAlertStatus(item?.status)) return false;
        if (priorityGroup !== "todos" && item?.criticidade !== priorityGroup) return false;
        return true;
      }),
    [
      formatStatusWithDate,
      priorityGroup,
      quickMunicipio,
      quickScoreRisk,
      quickScoreStatus,
      quickStatus,
      quickTipo,
      railCertFilters,
      railMunicipioFilters,
      railRiskFilters,
      railSanitaryComplexityFilter,
      railStatusFilter,
      railUrgencyMax,
      railUrgencyMin,
      rows,
      searchTerm,
      somenteAlertasLocal,
    ],
  );

  const filtered = React.useMemo(
    () => filteredBase.filter((item) => (kpiFilter !== "todos" ? item?.status_key_canonical === kpiFilter : true)),
    [filteredBase, kpiFilter],
  );

  const compareWithSort = React.useCallback((a, b, option, direction) => {
    const dir = direction === "desc" ? -1 : 1;
    const field = option?.value;
    if (!field) return 0;
    if (option?.isNumber) {
      const av = Number.isFinite(a?.[field]) ? Number(a[field]) : null;
      const bv = Number.isFinite(b?.[field]) ? Number(b[field]) : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    }
    const at = String(a?.[field] || "").trim();
    const bt = String(b?.[field] || "").trim();
    if (!at && !bt) return 0;
    if (!at) return 1;
    if (!bt) return -1;
    return at.localeCompare(bt, "pt-BR", { sensitivity: "base" }) * dir;
  }, []);

  const sortedFiltered = React.useMemo(() => {
    const selectedSort = sortOptions.find((option) => option.value === sortField) || defaultSort;
    const comparator = (a, b) => {
      const primary = compareWithSort(a, b, selectedSort, sortDir);
      if (primary !== 0) return primary;
      const secondary = compareWithSort(a, b, defaultSort, defaultSort.defaultDir);
      if (secondary !== 0) return secondary;
      return compareWithSort(a, b, { value: "empresa_display" }, "asc");
    };
    return [...filtered].sort(comparator);
  }, [compareWithSort, defaultSort, filtered, sortDir, sortField, sortOptions]);

  const grouped = React.useMemo(() => {
    const selectedSort = sortOptions.find((option) => option.value === sortField) || defaultSort;
    const comparator = (a, b) => {
      const primary = compareWithSort(a, b, selectedSort, sortDir);
      if (primary !== 0) return primary;
      const secondary = compareWithSort(a, b, defaultSort, defaultSort.defaultDir);
      if (secondary !== 0) return secondary;
      return compareWithSort(a, b, { value: "empresa_display" }, "asc");
    };
    const map = new Map(groupConfig.map((cfg) => [cfg.key, []]));
    filtered.forEach((item) => {
      if (item.criticidade && map.has(item.criticidade)) map.get(item.criticidade).push(item);
    });
    map.forEach((list) => list.sort(comparator));
    return map;
  }, [compareWithSort, defaultSort, filtered, groupConfig, sortDir, sortField, sortOptions]);

  const renovacoesNotificacaoCount = React.useMemo(() => {
    let count = 0;
    grouped.forEach((items) => {
      count += items.length;
    });
    return count;
  }, [grouped]);

  const empresasMatriz = React.useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      const key = item?.empresa_id || item?.company_id || item?.cnpj || item?.empresa_display;
      if (!map.has(key)) {
        map.set(key, {
          key,
          empresa: item.empresa_display,
          cnpj: item?.cnpj,
          municipio: item?.municipio,
          sem_vinculo: item?.sem_vinculo,
          byTipo: {},
        });
      }
      map.get(key).byTipo[item.tipo_norm] = item;
    });
    return Array.from(map.values()).sort((a, b) => a.empresa.localeCompare(b.empresa));
  }, [filtered]);

  const matrizCards = React.useMemo(
    () =>
      empresasMatriz.map((empresa) => ({
        ...empresa,
        totalTipos: tipos.reduce((acc, tipo) => (empresa.byTipo[tipo.key] ? acc + 1 : acc), 0),
        vencidos: tipos.reduce((acc, tipo) => {
          const item = empresa.byTipo[tipo.key];
          return item?.criticidade === "vencido" ? acc + 1 : acc;
        }, 0),
      })),
    [empresasMatriz, tipos],
  );

  const kpis = React.useMemo(() => {
    const all = filteredBase.length;
    const make = (status) => filteredBase.filter((r) => r.status_key_canonical === status).length;
    return [
      { key: "todos", label: "Total", value: all },
      { key: "vencido", label: "Vencido", value: make("vencido") },
      { key: "nao_possui", label: "N\u00e3o possui", value: make("nao_possui") },
      { key: "sujeito", label: "Sujeito", value: make("sujeito") },
      { key: "nao_exigido", label: "N\u00e3o exigido", value: make("nao_exigido") },
    ];
  }, [filteredBase]);

  const heroKpis = React.useMemo(() => {
    const total = filteredBase.length;
    const vencidas = filteredBase.filter((item) => item?.criticidade === "vencido").length;
    const vencendo = filteredBase.filter((item) => {
      const dias = Number(item?.dias_para_vencer);
      return Number.isFinite(dias) && dias >= 0 && dias <= 30;
    }).length;
    const pendentes = filteredBase.filter((item) => {
      const key = String(item?.status_key_canonical || "").trim();
      return key.startsWith("aguardando_") || key === "em_analise" || key === "sujeito";
    }).length;
    return [
      { key: "total", label: "Total de registros", value: total, subtitle: `${filtered.length} em exibi\u00e7\u00e3o` },
      { key: "vencidas", label: "Vencidas", value: vencidas, subtitle: "A\u00e7\u00e3o imediata" },
      { key: "vencendo", label: "Vencendo", value: vencendo, subtitle: "Pr\u00f3ximos 30 dias" },
      { key: "pendentes", label: "Pendentes / Em andamento", value: pendentes, subtitle: "Requer acompanhamento" },
    ];
  }, [filtered.length, filteredBase]);

  const activeFilterBadges = React.useMemo(() => {
    const badges = [];
    if (searchTerm.trim()) badges.push({ key: "q", label: `Busca: ${searchTerm.trim()}`, onClear: () => setSearchTerm("") });
    if (quickMunicipio !== "todos") badges.push({ key: "municipio", label: `Munic\u00edpio: ${quickMunicipio}`, onClear: () => setQuickMunicipio("todos") });
    if (quickTipo !== "todos") badges.push({ key: "tipo", label: `Tipo: ${tipos.find((t) => t.key === quickTipo)?.label || quickTipo}`, onClear: () => setQuickTipo("todos") });
    if (quickStatus !== "todos") badges.push({ key: "status", label: `Status: ${formatStatusDisplay(quickStatus)}`, onClear: () => setQuickStatus("todos") });
    if (quickScoreRisk !== "todos") badges.push({ key: "risk", label: `Risco: ${scoreRiskOptions.find((opt) => opt.value === quickScoreRisk)?.label || quickScoreRisk}`, onClear: () => setQuickScoreRisk("todos") });
    if (quickScoreStatus !== "todos") badges.push({ key: "scoreStatus", label: `Score status: ${scoreStatusOptions.find((opt) => opt.value === quickScoreStatus)?.label || quickScoreStatus}`, onClear: () => setQuickScoreStatus("todos") });
    if (priorityGroup !== "todos") badges.push({ key: "criticidade", label: `Criticidade: ${groupConfig.find((group) => group.key === priorityGroup)?.label || priorityGroup}`, onClear: () => setPriorityGroup("todos") });
    if (somenteAlertasLocal) badges.push({ key: "alertas", label: "Somente alertas", onClear: () => setSomenteAlertasLocal(false) });
    if (railStatusFilter !== "ativas") badges.push({ key: "rail-status", label: `Empresa: ${railStatusFilter}`, onClear: () => setRailStatusFilter("ativas") });
    if (railRiskFilters.length !== 4) badges.push({ key: "rail-risk", label: `Risco CNAE: ${railRiskFilters.length}`, onClear: () => setRailRiskFilters(["HIGH", "MEDIUM", "LOW", "UNMAPPED"]) });
    if (railCertFilters.length !== 4) badges.push({ key: "rail-cert", label: `Certificado: ${railCertFilters.length}`, onClear: () => setRailCertFilters(["valido", "vencendo", "vencido", "sem_certificado"]) });
    if (railMunicipioFilters.length > 0) badges.push({ key: "rail-municipio", label: `Munic\u00edpio local: ${railMunicipioFilters.length}`, onClear: () => setRailMunicipioFilters([]) });
    if (railSanitaryComplexityFilter !== "todas") badges.push({ key: "rail-sanitary-complexity", label: `Comp. sanit\u00e1ria: ${formatSanitaryComplexityLabel(railSanitaryComplexityFilter)}`, onClear: () => setRailSanitaryComplexityFilter("todas") });
    if (railUrgencyMin > 0 || railUrgencyMax < 100) {
      badges.push({
        key: "rail-score",
        label: `Score de urg\u00eancia: ${railUrgencyMin}-${railUrgencyMax}`,
        onClear: () => {
          setRailUrgencyMin(0);
          setRailUrgencyMax(100);
        },
      });
    }
    return badges;
  }, [
    formatSanitaryComplexityLabel,
    formatStatusDisplay,
    groupConfig,
    priorityGroup,
    quickMunicipio,
    quickScoreRisk,
    quickScoreStatus,
    quickStatus,
    quickTipo,
    railCertFilters.length,
    railMunicipioFilters.length,
    railRiskFilters.length,
    railSanitaryComplexityFilter,
    railStatusFilter,
    railUrgencyMax,
    railUrgencyMin,
    scoreRiskOptions,
    scoreStatusOptions,
    searchTerm,
    somenteAlertasLocal,
    tipos,
  ]);

  const railActiveCount = React.useMemo(() => {
    let count = 0;
    if (railStatusFilter !== "ativas") count += 1;
    if (railRiskFilters.length !== 4) count += 1;
    if (railCertFilters.length !== 4) count += 1;
    if (railMunicipioFilters.length > 0) count += 1;
    if (railSanitaryComplexityFilter !== "todas") count += 1;
    if (railUrgencyMin > 0 || railUrgencyMax < 100) count += 1;
    return count;
  }, [
    railCertFilters.length,
    railMunicipioFilters.length,
    railRiskFilters.length,
    railSanitaryComplexityFilter,
    railStatusFilter,
    railUrgencyMax,
    railUrgencyMin,
  ]);

  const toggleRailFilter = React.useCallback((setter, key) => {
    setter((current) => {
      const list = Array.isArray(current) ? current : [];
      return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
    });
  }, []);

  const clearSharedRailFilters = React.useCallback(() => {
    setRailStatusFilter("ativas");
    setRailRiskFilters(["HIGH", "MEDIUM", "LOW", "UNMAPPED"]);
    setRailCertFilters(["valido", "vencendo", "vencido", "sem_certificado"]);
    setRailMunicipioFilters([]);
    setRailSanitaryComplexityFilter("todas");
    setRailUrgencyMin(0);
    setRailUrgencyMax(100);
  }, []);

  const clearContextFilters = React.useCallback(() => {
    setSearchTerm("");
    setQuickMunicipio("todos");
    setQuickTipo("todos");
    setQuickStatus("todos");
    setQuickScoreRisk("todos");
    setQuickScoreStatus("todos");
    setPriorityGroup("todos");
    setSomenteAlertasLocal(false);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    quickMunicipio,
    setQuickMunicipio,
    quickTipo,
    setQuickTipo,
    quickStatus,
    setQuickStatus,
    quickScoreRisk,
    setQuickScoreRisk,
    quickScoreStatus,
    setQuickScoreStatus,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    somenteAlertasLocal,
    setSomenteAlertasLocal,
    kpiFilter,
    setKpiFilter,
    priorityGroup,
    setPriorityGroup,
    railStatusFilter,
    setRailStatusFilter,
    railRiskFilters,
    setRailRiskFilters,
    railCertFilters,
    setRailCertFilters,
    railMunicipioFilters,
    setRailMunicipioFilters,
    railSanitaryComplexityFilter,
    setRailSanitaryComplexityFilter,
    railUrgencyMin,
    setRailUrgencyMin,
    railUrgencyMax,
    setRailUrgencyMax,
    municipios,
    railMunicipioOptions,
    railSanitaryComplexityOptions,
    filteredBase,
    filtered,
    sortedFiltered,
    grouped,
    renovacoesNotificacaoCount,
    empresasMatriz,
    matrizCards,
    kpis,
    heroKpis,
    activeFilterBadges,
    railActiveCount,
    toggleRailFilter,
    clearSharedRailFilters,
    clearContextFilters,
  };
}
