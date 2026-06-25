import { useEffect, useState } from "react";

export default function useProcessViewState({
  panelPreset,
  defaultSort,
}) {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    return localStorage.getItem("processos.viewMode") || "cards";
  });
  const [sortField, setSortField] = useState(defaultSort.value);
  const [sortDir, setSortDir] = useState(defaultSort.defaultDir);
  const [selectedTipo, setSelectedTipo] = useState("TODOS");
  const [queueMode, setQueueMode] = useState("all");
  const [selectedUrgencyBucket, setSelectedUrgencyBucket] = useState("all");
  const [companyStatusFilters, setCompanyStatusFilters] = useState(["Todas"]);
  const [riskFilters, setRiskFilters] = useState(["high", "medium", "low", "unmapped"]);
  const [certFilters, setCertFilters] = useState(["vencendo", "vencido", "valido", "sem_certificado"]);
  const [municipioFilters, setMunicipioFilters] = useState([]);
  const [urgencyMin, setUrgencyMin] = useState(0);
  const [urgencyMax, setUrgencyMax] = useState(100);
  const [detailsDrawer, setDetailsDrawer] = useState({ open: false, processo: null });

  useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "processos") return;
    setSelectedTipo("TODOS");
    setQueueMode("urgent");
    setViewMode("cards");
    setSelectedUrgencyBucket(preset?.bucket || "all");
    setSortField(defaultSort.value);
    setSortDir(defaultSort.defaultDir);
  }, [defaultSort.defaultDir, defaultSort.value, panelPreset]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("processos.viewMode", viewMode);
    }
  }, [viewMode]);

  return {
    viewMode,
    setViewMode,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    selectedTipo,
    setSelectedTipo,
    queueMode,
    setQueueMode,
    selectedUrgencyBucket,
    setSelectedUrgencyBucket,
    companyStatusFilters,
    setCompanyStatusFilters,
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
    detailsDrawer,
    setDetailsDrawer,
  };
}
