import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SideDrawer } from "@/components/ui/side-drawer";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import { Chip } from "@/components/Chip";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clipboard,
  Clock,
  FileText,
  MapPin,
  MoveRight,
  PanelRightClose,
  PencilLine,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { formatProcessDate, getDiversosOperacaoLabel, getProcessBaseType, normalizeProcessType } from "@/lib/process";
import { normalizeIdentifier, normalizeText, removeDiacritics } from "@/lib/text";
import { maskCNPJ } from "@/lib/format";
import { isProcessStatusActiveOrPending, resolveProcessoTipo } from "@/lib/status";
import { fetchJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { getPriorityTypeFields, getTypeFields } from "@/lib/processTypeFields";
import { getProcessUrgency, URGENCY_BUCKETS } from "@/lib/processUrgency";

const PROCESS_TYPE_DISPLAY = {
  BOMBEIROS: "CERCON",
  FUNCIONAMENTO: "Funcionamento",
  DIVERSOS: "Diversos",
  USO_DO_SOLO: "Uso do Solo",
  SANITARIO: "Sanitário",
  ALVARA_SANITARIO: "Alvará Sanitário",
};

const PROCESS_TYPE_ICON = {
  BOMBEIROS: Settings,
  FUNCIONAMENTO: Settings,
  DIVERSOS: Settings,
  USO_DO_SOLO: MapPin,
  SANITARIO: Settings,
  ALVARA_SANITARIO: Settings,
};

const TABLE_COLUMNS = [
  { id: "tipoDisplay", label: "Tipo" },
  { id: "empresa", label: "Empresa" },
  { id: "protocolo", label: "Protocolo" },
  { id: "data_solicitacao", label: "Data solicitação", isDate: true },
  { id: "municipio", label: "Município" },
  { id: "situacao", label: "Situação", isStatus: true },
  { id: "detalhes", label: "Detalhes" },
  { id: "obs", label: "OBS" },
];

const SORT_OPTIONS = [
  { value: "urgencyScore", label: "Urgência", defaultDir: "desc", isNumber: true },
  { value: "data_solicitacao", label: "Data solicitação", defaultDir: "desc", isDate: true },
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "situacao", label: "Situação", defaultDir: "asc" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];
const SECONDARY_SORT = SORT_OPTIONS[1];

const normalizeTipoKey = (tipoBase) =>
  removeDiacritics(normalizeText(tipoBase ?? ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const extractDateValue = (value) => {
  const normalized = normalizeText(value).trim();
  if (!normalized) return null;
  const parsed = dayjs(normalized, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (parsed.isValid()) return parsed.valueOf();
  const fallback = dayjs(normalized);
  return fallback.isValid() ? fallback.valueOf() : null;
};

const compareProcessos = (a, b, field, direction, meta = {}) => {
  const dir = direction === "desc" ? -1 : 1;
  if (meta.isDate) {
    const aValue = extractDateValue(a?.[field]);
    const bValue = extractDateValue(b?.[field]);
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return (aValue - bValue) * dir;
  }
  if (meta.isNumber) {
    const aValue = Number(a?.[field] ?? 0);
    const bValue = Number(b?.[field] ?? 0);
    return (aValue - bValue) * dir;
  }
  const aText = normalizeText(a?.[field] ?? "").trim();
  const bText = normalizeText(b?.[field] ?? "").trim();
  if (!aText && !bText) return 0;
  if (!aText) return 1;
  if (!bText) return -1;
  return aText.localeCompare(bText, "pt-BR", { sensitivity: "base" }) * dir;
};

const formatDateTime = (value) => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY HH:mm");
};

const resolveProcessId = (proc) =>
  normalizeText(proc?.id ?? proc?.process_id ?? proc?.processId ?? proc?.processo_id).trim();

const formatMunicipio = (proc) => formatMunicipioDisplay(proc?.municipio_exibicao || proc?.municipio);

const getTipoDisplay = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return PROCESS_TYPE_DISPLAY[key] ?? tipoBase ?? "Processo";
};

const resolveTipoFromProcess = (proc) => {
  const tipoNormalizado = normalizeProcessType(proc);
  const tipoBase = getProcessBaseType(tipoNormalizado);
  return { tipoBase, tipoKey: normalizeTipoKey(tipoBase), tipoDisplay: getTipoDisplay(tipoBase) };
};

const getProcessKey = (proc, index) => {
  const tipoKey = proc?.tipoKey || normalizeTipoKey(proc?.tipo);
  const parts = [proc?.id, proc?.protocolo, proc?.cnpj, proc?.empresa]
    .map((value) => normalizeText(value).trim())
    .filter(Boolean);
  const suffix = parts.length > 0 ? parts.join("-") : String(index);
  return [tipoKey, suffix].filter(Boolean).join("-");
};

const EXCLUDED_URGENT_STATUS_KEYWORDS = [
  "concluido",
  "licenciado",
  "indeferido",
  "cancelado",
];
const isUrgentByStatus = (proc) => {
  const statusKey = removeDiacritics(
    normalizeText(proc?.situacao || proc?.status || "").toLowerCase(),
  ).trim();
  if (!statusKey) return true;
  return !EXCLUDED_URGENT_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword));
};

const renderStatus = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return <StatusBadge status={text} />;
};

const renderObsSnippet = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const snippet = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600" title={text}>
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="line-clamp-1 text-left leading-snug">{snippet}</span>
    </div>
  );
};

const renderFieldValue = (field) => {
  if (field.isStatus) return renderStatus(field.rawValue);
  const text = normalizeText(field.value).trim();
  if (!text || text === "—") return "—";
  return (
    <Chip variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
      {text}
    </Chip>
  );
};

const InfoItem = ({ label, children, className = "" }) => (
  <div className={cn("space-y-1 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5", className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="text-sm text-slate-800">{children ?? "—"}</div>
  </div>
);

export default function ProcessosScreen({
  processosNormalizados,
  modoFoco,
  soAlertas,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
  panelPreset,
}) {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    return localStorage.getItem("processos.viewMode") || "cards";
  });
  const [sortField, setSortField] = useState(DEFAULT_SORT.value);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT.defaultDir);
  const [selectedTipo, setSelectedTipo] = useState("TODOS");
  const [queueMode, setQueueMode] = useState("all");
  const [selectedUrgencyBucket, setSelectedUrgencyBucket] = useState("all");
  const [expandedObs, setExpandedObs] = useState({});
  const [obsDrawer, setObsDrawer] = useState({ open: false, processo: null });
  const [obsDraft, setObsDraft] = useState("");
  const [obsHistory, setObsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsOverrides, setObsOverrides] = useState({});
  const [historyError, setHistoryError] = useState(null);
  const [detailsDrawer, setDetailsDrawer] = useState({ open: false, processo: null });

  useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "processos") return;
    setSelectedTipo("TODOS");
    setQueueMode("urgent");
    setViewMode("cards");
    setSelectedUrgencyBucket(preset?.bucket || "all");
    setSortField(DEFAULT_SORT.value);
    setSortDir(DEFAULT_SORT.defaultDir);
  }, [panelPreset]);

  const openEditProcesso = useCallback((processId) => {
    if (!processId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-process", {
        detail: { mode: "edit", processId },
      }),
    );
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("processos.viewMode", viewMode);
    }
  }, [viewMode]);

  const processosVisiveis = useMemo(() => {
    return processosNormalizados.filter((proc) => {
      const matchesMunicipio = matchesMunicipioFilter(proc);
      const matchesBusca = matchesQuery(
        [
          proc.empresa,
          proc.tipo,
          proc.tipoNormalizado,
          proc.status,
          proc.situacao,
          proc.status_padrao,
          proc.obs,
          proc.protocolo,
          proc.cnpj,
          proc.data_solicitacao,
          proc.prazo,
          proc.operacao,
          proc.orgao,
          proc.alvara,
          proc.inscricao_imobiliaria,
          proc.servico,
          proc.taxa,
          proc.notificacao,
          proc.data_val,
          proc.municipio,
          proc.tpi,
          proc.area_m2,
          proc.projeto,
          proc.tpi_sync_status,
          proc.taxa_bombeiros_sync_status,
          proc.taxa_sanitaria_sync_status,
          proc.alvara_sanitario_status,
        ],
        {
          nome: [proc.empresa],
          razao: [proc.empresa],
          cnpj: [proc.cnpj],
        },
      );

      const matchesFoco = modoFoco ? isProcessStatusActiveOrPending(proc.status) : true;
      const statusKey = removeDiacritics(normalizeText(proc?.situacao || proc?.status).toLowerCase());
      const blockedByAlertMode =
        soAlertas &&
        ["pendente", "concluido", "licenciado"].some((keyword) => statusKey.includes(keyword));

      return matchesMunicipio && matchesBusca && matchesFoco && !blockedByAlertMode;
    });
  }, [matchesMunicipioFilter, matchesQuery, modoFoco, processosNormalizados, soAlertas]);

  const fetchObsHistory = useCallback(async (processoId) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await fetchJson(`/api/v1/processos/${processoId}/obs-history`);
      setObsHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao carregar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const openObsDrawer = useCallback(
    (processo) => {
      const processId = resolveProcessId(processo);
      if (!processId) return;
      setObsDrawer({ open: true, processo });
      setObsDraft(obsOverrides[processId] ?? processo.obs ?? "");
      fetchObsHistory(processId);
    },
    [fetchObsHistory, obsOverrides],
  );

  const closeObsDrawer = useCallback(() => {
    setObsDrawer({ open: false, processo: null });
    setObsHistory([]);
    setHistoryError(null);
  }, []);

  const saveObs = useCallback(async () => {
    const processId = resolveProcessId(obsDrawer?.processo);
    if (!processId) return;
    setSavingObs(true);
    try {
      await fetchJson(`/api/v1/processos/${processId}/obs`, {
        method: "PATCH",
        body: { obs: obsDraft },
      });
      setObsOverrides((prev) => ({ ...prev, [processId]: obsDraft }));
      await fetchObsHistory(processId);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao salvar OBS.");
    } finally {
      setSavingObs(false);
    }
  }, [fetchObsHistory, obsDraft, obsDrawer?.processo]);

  const resolveObsValue = useCallback(
    (proc) => obsOverrides[resolveProcessId(proc)] ?? proc?.obs,
    [obsOverrides],
  );

  const processosEnriquecidos = useMemo(() => {
    return processosVisiveis.map((proc) => {
      const { tipoBase, tipoKey, tipoDisplay } = resolveTipoFromProcess(proc);
      const diversosOperacaoLabel = tipoBase === "Diversos" ? getDiversosOperacaoLabel(proc.operacao) : undefined;
      const merged = { ...proc, tipoBase, tipoKey, tipoDisplay, diversosOperacaoLabel };
      const urgency = getProcessUrgency(merged);
      return {
        ...merged,
        urgencyScore: urgency.score,
        urgencyBuckets: urgency.buckets,
        urgencyMeta: urgency,
      };
    });
  }, [processosVisiveis]);

  const tiposDisponiveis = useMemo(() => {
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

  const processosPorTipo = useMemo(
    () =>
      selectedTipo === "TODOS"
        ? processosEnriquecidos
        : processosEnriquecidos.filter((proc) => proc.tipoKey === selectedTipo),
    [processosEnriquecidos, selectedTipo],
  );

  const urgencyCounts = useMemo(() => {
    const counts = {
      all: processosPorTipo.filter((proc) => isUrgentByStatus(proc)).length,
    };
    URGENCY_BUCKETS.forEach((bucket) => {
      if (bucket.key === "all") return;
      counts[bucket.key] = processosPorTipo.filter((proc) =>
        isUrgentByStatus(proc) && proc.urgencyBuckets.includes(bucket.key),
      ).length;
    });
    return counts;
  }, [processosPorTipo]);

  const processosFiltradosQueue = useMemo(() => {
    if (queueMode !== "urgent") return processosPorTipo;
    const urgentOnly = processosPorTipo.filter((proc) => isUrgentByStatus(proc));
    if (selectedUrgencyBucket === "all") return urgentOnly;
    return urgentOnly.filter((proc) => proc.urgencyBuckets.includes(selectedUrgencyBucket));
  }, [processosPorTipo, queueMode, selectedUrgencyBucket]);

  const columnMetaMap = useMemo(() => {
    return TABLE_COLUMNS.reduce((acc, column) => {
      acc[column.id] = column;
      return acc;
    }, {});
  }, []);

  const processosOrdenados = useMemo(() => {
    const comparator = (a, b) => {
      const meta = SORT_OPTIONS.find((option) => option.value === sortField) || columnMetaMap[sortField] || {};
      const primary = compareProcessos(a, b, sortField, sortDir, meta);
      if (primary !== 0) return primary;

      const byUrgency = compareProcessos(a, b, DEFAULT_SORT.value, DEFAULT_SORT.defaultDir, DEFAULT_SORT);
      if (byUrgency !== 0) return byUrgency;

      const byDate = compareProcessos(a, b, SECONDARY_SORT.value, SECONDARY_SORT.defaultDir, SECONDARY_SORT);
      if (byDate !== 0) return byDate;

      return compareProcessos(a, b, "empresa", "asc");
    };
    return [...processosFiltradosQueue].sort(comparator);
  }, [columnMetaMap, processosFiltradosQueue, sortDir, sortField]);

  const resolveDefaultSortDir = useCallback(
    (field) => SORT_OPTIONS.find((option) => option.value === field)?.defaultDir ?? "asc",
    [],
  );

  const handleSortClick = (field, preferDefaultFirst = false) => {
    const defaultDir = resolveDefaultSortDir(field);
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
        return;
      }
      if (sortDir === "desc") {
        setSortField(DEFAULT_SORT.value);
        setSortDir(DEFAULT_SORT.defaultDir);
        return;
      }
      setSortDir("asc");
      return;
    }
    setSortField(field);
    setSortDir(preferDefaultFirst ? defaultDir : "asc");
  };

  const toggleObsExpanded = (key) => {
    setExpandedObs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openDetailsDrawer = useCallback((processo) => {
    setDetailsDrawer({ open: true, processo });
  }, []);

  const detailsFields = useMemo(
    () => (detailsDrawer.processo ? getTypeFields(detailsDrawer.processo) : []),
    [detailsDrawer.processo],
  );

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {tiposDisponiveis.map((tipo) => {
                const isActive = selectedTipo === tipo.key;
                const Icon = PROCESS_TYPE_ICON[tipo.key] || Settings;
                return (
                  <button
                    key={tipo.key}
                    type="button"
                    onClick={() => setSelectedTipo(tipo.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      isActive && "border-brand-navy/30 bg-brand-navy-soft text-brand-navy shadow-sm",
                    )}
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span>{tipo.display}</span>
                    <InlineBadge variant="outline" className="bg-white text-slate-600">
                      {tipo.count}
                    </InlineBadge>
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/70 p-1">
              {[
                { key: "cards", label: "Cards" },
                { key: "table", label: "Tabela" },
              ].map((option) => {
                const isActive = viewMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setViewMode(option.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                      isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Fila operacional
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQueueMode("all");
                  setSelectedUrgencyBucket("all");
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  queueMode === "all"
                    ? "border-brand-navy/30 bg-brand-navy-soft text-brand-navy"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setQueueMode("urgent")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  queueMode === "urgent"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                Urgentes
                <InlineBadge variant="outline" className="bg-white text-slate-600">
                  {urgencyCounts.all || 0}
                </InlineBadge>
              </button>
            </div>
          </div>

          {queueMode === "urgent" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {URGENCY_BUCKETS.map((bucket) => {
                const isActive = selectedUrgencyBucket === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setSelectedUrgencyBucket(bucket.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "border-brand-navy/30 bg-brand-navy-soft text-brand-navy"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span>{bucket.label}</span>
                    <InlineBadge variant="outline" className="bg-white text-slate-600">
                      {bucket.key === "all" ? urgencyCounts.all || 0 : urgencyCounts[bucket.key] || 0}
                    </InlineBadge>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
            <div className="flex flex-wrap items-center gap-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortField === option.value;
                const directionSymbol = isActive ? (sortDir === "asc" ? "↑" : "↓") : null;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSortClick(option.value, true)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      isActive && "border-brand-navy/30 bg-brand-navy-soft text-brand-navy shadow-sm",
                    )}
                  >
                    <span>{option.label}</span>
                    {directionSymbol && <span className="text-xs">{directionSymbol}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {processosOrdenados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nenhum processo correspondente ao filtro.
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="max-h-[calc(100vh-280px)] overflow-auto overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                  <TableRow>
                    {TABLE_COLUMNS.map((column) => {
                      const isSortable = column.id !== "detalhes" && column.id !== "obs";
                      const isActive = sortField === column.id;
                      const icon = !isActive ? (
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-brand-navy" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-brand-navy" />
                      );
                      return (
                        <TableHead
                          key={column.id}
                          className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {isSortable ? (
                            <button
                              type="button"
                              onClick={() => handleSortClick(column.id)}
                              className="flex w-full items-center gap-2 text-left text-slate-700 transition hover:text-slate-900"
                            >
                              <span className="cursor-pointer select-none">{column.label}</span>
                              {icon}
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosOrdenados.map((proc, index) => {
                    const municipio = formatMunicipio(proc);
                    const obsValue = resolveObsValue(proc);
                    const maskedCnpj = maskCNPJ(proc?.cnpj);
                    const detailChips = getPriorityTypeFields(proc, 3);
                    return (
                      <TableRow
                        key={getProcessKey(proc, index)}
                        className="border-b border-slate-100 hover:bg-slate-50/60"
                      >
                        {TABLE_COLUMNS.map((column) => {
                          let content = normalizeText(proc?.[column.id]).trim() || "—";
                          if (column.id === "tipoDisplay") {
                            content = proc.tipoDisplay;
                          } else if (column.id === "empresa") {
                            content = (
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold leading-tight text-slate-800">
                                  {proc?.empresa || "—"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const value = maskCNPJ(proc?.cnpj);
                                    if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-navy transition hover:text-brand-navy-700"
                                >
                                  {maskedCnpj || "—"}
                                  <Clipboard className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            );
                          } else if (column.id === "protocolo") {
                            content = normalizeIdentifier(proc?.protocolo) || "—";
                          } else if (column.id === "data_solicitacao") {
                            content = formatProcessDate(proc?.data_solicitacao);
                          } else if (column.id === "municipio") {
                            content = municipio || "—";
                          } else if (column.id === "situacao") {
                            content = renderStatus(proc?.situacao || proc?.status);
                          } else if (column.id === "detalhes") {
                            content = (
                              <div className="flex min-w-[260px] flex-wrap items-center gap-2">
                                {detailChips.length > 0 ? (
                                  detailChips.map((field) => (
                                    <Chip key={field.key} variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
                                      {field.label}: {field.value}
                                    </Chip>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-500">Sem campos do tipo.</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openDetailsDrawer(proc)}
                                  className="text-[11px] font-semibold text-brand-navy underline-offset-2 hover:underline"
                                >
                                  Ver todos
                                </button>
                              </div>
                            );
                          } else if (column.id === "obs") {
                            content = (
                              <div className="flex max-w-xs items-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditProcesso(resolveProcessId(proc))}
                                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                  title="Editar processo"
                                >
                                  <PencilLine className="h-4 w-4" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openObsDrawer(proc)}
                                  className="inline-flex min-w-0 flex-1 items-start gap-2 text-left text-slate-700 transition-colors hover:text-slate-900"
                                >
                                  {renderObsSnippet(obsValue)}
                                </button>
                              </div>
                            );
                          }
                          return (
                            <TableCell key={column.id} className="min-w-[140px] align-top px-4 py-3 text-xs text-slate-700">
                              {content}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {processosOrdenados.map((proc, index) => {
              const obsValue = resolveObsValue(proc);
              const obsText = normalizeText(obsValue).trim();
              const obsKey = resolveProcessId(proc) || proc?.protocolo || `${proc.empresa}-${index}`;
              const isObsExpanded = !!expandedObs[obsKey];
              const hasLongObs = obsText.length > 140;
              const municipio = formatMunicipio(proc);
              const tipoResolved = resolveProcessoTipo(proc.tipoKey || proc.tipoBase || proc.tipo);
              const maskedCnpj = maskCNPJ(proc?.cnpj);
              const inlineTypeFields = getPriorityTypeFields(proc, 4);
              const Icon = PROCESS_TYPE_ICON[proc.tipoKey] || Settings;

              return (
                <Card
                  key={getProcessKey(proc, index)}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip variant={tipoResolved.variant} icon={<Icon className="h-4 w-4" />}>
                          {proc.tipoDisplay}
                        </Chip>
                        <StatusBadge status={proc?.situacao || proc?.status || "Situação"} />
                        <Chip variant="warning" className="border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                          Urgência {Math.max(0, Math.round(proc.urgencyScore))}
                        </Chip>
                      </div>
                      <p className="text-base font-semibold leading-tight text-slate-900">{proc?.empresa || "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      {maskedCnpj && maskedCnpj !== "—" && (
                        <button
                          type="button"
                          onClick={() => {
                            const value = maskCNPJ(proc?.cnpj);
                            if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                          }}
                          className="text-[12px] font-semibold text-brand-navy transition hover:text-brand-navy-700"
                        >
                          {maskedCnpj}
                        </button>
                      )}
                      {normalizeText(proc?.prazo).trim() && (
                        <Chip variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
                          Prazo {proc.prazo}
                        </Chip>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoItem label="Protocolo">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {normalizeIdentifier(proc?.protocolo) || "—"}
                          </span>
                          {proc?.protocolo && (
                            <button
                              type="button"
                              onClick={() => {
                                const value = normalizeIdentifier(proc?.protocolo);
                                if (value) handleCopy(value, `Protocolo copiado: ${value}`);
                              }}
                              className="text-slate-500 transition hover:text-slate-700"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </InfoItem>

                      <InfoItem label="Data solicitação">{formatProcessDate(proc?.data_solicitacao)}</InfoItem>
                      <InfoItem label="Município">{municipio || "—"}</InfoItem>
                      <InfoItem label="CNPJ">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{maskedCnpj || "—"}</span>
                          {maskedCnpj && maskedCnpj !== "—" && (
                            <button
                              type="button"
                              onClick={() => {
                                const value = maskCNPJ(proc?.cnpj);
                                if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                              }}
                              className="text-slate-500 transition hover:text-slate-700"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </InfoItem>

                      <InfoItem label="OBS" className="md:col-span-2">
                        {obsText ? (
                          <div className="space-y-2">
                            <p className={cn("text-sm leading-relaxed text-slate-700", !isObsExpanded && "line-clamp-2")}>
                              {obsText}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              {hasLongObs && (
                                <button
                                  type="button"
                                  onClick={() => toggleObsExpanded(obsKey)}
                                  className="text-xs font-semibold text-brand-navy transition hover:text-brand-navy-700"
                                >
                                  Ver {isObsExpanded ? "menos" : "mais"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openObsDrawer(proc)}
                                className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
                              >
                                Editar OBS
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-2">
                            <span className="text-sm text-slate-500">Nenhuma observação.</span>
                            <button
                              type="button"
                              onClick={() => openObsDrawer(proc)}
                              className="text-xs font-semibold text-brand-navy underline-offset-2 hover:underline"
                            >
                              Adicionar
                            </button>
                          </div>
                        )}
                      </InfoItem>

                      {inlineTypeFields.map((field) => (
                        <InfoItem key={field.key} label={field.label}>
                          {renderFieldValue(field)}
                        </InfoItem>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openDetailsDrawer(proc)}
                        className="text-xs font-semibold text-brand-navy underline-offset-2 hover:underline"
                      >
                        Ver todos os campos do tipo
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditProcesso(resolveProcessId(proc))}
                        data-testid="process-edit-button"
                        className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy-foreground transition hover:bg-brand-navy-700"
                        title="Editar processo"
                      >
                        <PencilLine className="h-4 w-4" />
                        Editar
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <SideDrawer
        open={detailsDrawer.open}
        onClose={() => setDetailsDrawer({ open: false, processo: null })}
        title={detailsDrawer?.processo?.empresa || "Campos do tipo"}
        subtitle={detailsDrawer?.processo ? `Campos do tipo: ${detailsDrawer.processo.tipoDisplay || detailsDrawer.processo.tipo || "Processo"}` : "Campos do tipo"}
      >
        {detailsDrawer.processo ? (
          <div className="space-y-3">
            {detailsFields.length > 0 ? (
              detailsFields.map((field) => (
                <InfoItem key={field.key} label={field.label}>
                  {renderFieldValue(field)}
                </InfoItem>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Tipo sem campos específicos configurados.
              </div>
            )}
          </div>
        ) : null}
      </SideDrawer>

      {obsDrawer.open && obsDrawer.processo && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeObsDrawer}
            className="flex-1 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Observações</p>
                <p className="text-base font-semibold leading-tight text-slate-900">
                  {obsDrawer.processo.empresa || "Empresa"}
                </p>
                <p className="text-xs text-slate-500">
                  {getTipoDisplay(obsDrawer.processo.tipo)} • Protocolo {obsDrawer.processo.protocolo || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeObsDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-800">OBS</label>
                  {savingObs && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
                <textarea
                  rows={5}
                  value={obsDraft}
                  onChange={(event) => setObsDraft(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy-soft"
                  placeholder="Adicionar observação"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeObsDrawer}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveObs}
                    disabled={savingObs}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-brand-navy-foreground shadow-sm transition-colors hover:bg-brand-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PanelRightClose className="h-4 w-4" /> Salvar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Histórico</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingHistory && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                    <button
                      type="button"
                      onClick={() => {
                        const processId = resolveProcessId(obsDrawer.processo);
                        if (processId) fetchObsHistory(processId);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>

                {historyError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    {historyError}
                  </div>
                ) : obsHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    Nenhuma alteração registrada para este processo.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {obsHistory.map((entry) => (
                      <div
                        key={entry.id || `${entry.changed_at || entry.timestamp}-${(entry.old_obs || entry.old_value || "").length}`}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-inner"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDateTime(entry.changed_at || entry.timestamp)}</span>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Anterior</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.old_obs || entry.old_value || "—"}>
                              {normalizeText(entry.old_obs || entry.old_value).trim() || "—"}
                            </p>
                          </div>
                          <div className="hidden items-center justify-center md:flex">
                            <MoveRight className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atual</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.new_obs || entry.new_value || "—"}>
                              {normalizeText(entry.new_obs || entry.new_value).trim() || "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
