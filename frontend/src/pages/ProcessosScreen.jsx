import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import { Chip } from "@/components/Chip";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  Clipboard,
  FileText,
  MapPin,
  MoveRight,
  PanelRightClose,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { formatProcessDate, getDiversosOperacaoLabel, getProcessBaseType, normalizeProcessType } from "@/lib/process";
import { normalizeIdentifier, normalizeText, removeDiacritics } from "@/lib/text";
import { maskCNPJ } from "@/lib/format";
import { isProcessStatusActiveOrPending } from "@/lib/status";
import { fetchJson } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const normalizeTipoKey = (tipoBase) =>
  removeDiacritics(normalizeText(tipoBase ?? ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const badgeBase =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const tipoBadge = {
  SANITARIO: `${badgeBase} bg-violet-50 text-violet-700 ring-violet-200`,
  "ALVARA SANITARIO": `${badgeBase} bg-violet-50 text-violet-700 ring-violet-200`,
  ALVARA_SANITARIO: `${badgeBase} bg-violet-50 text-violet-700 ring-violet-200`,
  CERCON: `${badgeBase} bg-amber-50 text-amber-700 ring-amber-200`,
  DIVERSOS: `${badgeBase} bg-slate-50 text-slate-700 ring-slate-200`,
  FUNCIONAMENTO: `${badgeBase} bg-blue-50 text-blue-700 ring-blue-200`,
  "LICENCA AMBIENTAL": `${badgeBase} bg-emerald-50 text-emerald-700 ring-emerald-200`,
  AMBIENTAL: `${badgeBase} bg-emerald-50 text-emerald-700 ring-emerald-200`,
  "USO DO SOLO": `${badgeBase} bg-orange-50 text-orange-700 ring-orange-200`,
};

function normKey(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const baseColumns = [
  { id: "empresa", label: "Empresa" },
  { id: "protocolo", label: "Protocolo" },
  { id: "data_solicitacao", label: "Data solicitação", isDate: true },
  { id: "municipio", label: "Município" },
  { id: "situacao", label: "Situação", isStatus: true },
  { id: "obs", label: "OBS" },
];

const sanitarioColumns = [
  { id: "servico", label: "Serviço" },
  { id: "notificacao", label: "Notificação" },
  { id: "taxa_sanitaria_sync_status", label: "Taxa", isStatus: true },
  { id: "alvara_sanitario_validade", label: "Validade", isDate: true },
  { id: "alvara_sanitario_status", label: "Status validade", isStatus: true },
];

const extraColumnsByTipo = {
  DIVERSOS: [
    { id: "operacao", label: "Operação" },
    { id: "orgao", label: "Órgão" },
  ],
  FUNCIONAMENTO: [{ id: "alvara", label: "Alvará" }],
  BOMBEIROS: [
    { id: "area_m2", label: "Área (m²)" },
    { id: "projeto", label: "Projeto" },
    { id: "tpi_sync_status", label: "TPI", isStatus: true },
  ],
  USO_DO_SOLO: [{ id: "inscricao_imobiliaria", label: "Inscrição imobiliária" }],
  SANITARIO: sanitarioColumns,
  ALVARA_SANITARIO: sanitarioColumns,
};

const SORT_OPTIONS = [
  { value: "data_solicitacao", label: "Data solicitação", defaultDir: "desc", isDate: true },
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "situacao", label: "Situação", defaultDir: "asc" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];
const SECONDARY_SORT = SORT_OPTIONS[1];

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

const InfoPill = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
    {children}
  </span>
);

const InfoItem = ({ label, children, className = "" }) => (
  <div className={cn("space-y-1 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5", className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="text-sm text-slate-800">{children ?? "—"}</div>
  </div>
);

const renderStatus = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return <StatusBadge status={text} />;
};

const formatMunicipio = (proc) => {
  const municipio = normalizeText(proc?.municipio_exibicao || proc?.municipio).trim();
  return municipio;
};

const renderObsSnippet = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const snippet = text.length > 80 ? `${text.slice(0, 77)}…` : text;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600" title={text}>
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="line-clamp-1 text-left leading-snug">{snippet}</span>
    </div>
  );
};

const renderChip = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return (
    <Chip variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
      {text}
    </Chip>
  );
};

const getProcessKey = (proc, index) => {
  const tipoKey = proc?.tipoKey || normalizeTipoKey(proc?.tipo);
  const parts = [proc?.id, proc?.protocolo, proc?.cnpj, proc?.empresa]
    .map((value) => normalizeText(value).trim())
    .filter(Boolean);

  const suffix = parts.length > 0 ? parts.join("-") : String(index);
  return [tipoKey, suffix].filter(Boolean).join("-");
};

const getTipoDisplay = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return PROCESS_TYPE_DISPLAY[key] ?? tipoBase ?? "Processo";
};

const resolveTipoFromProcess = (proc) => {
  const tipoNormalizado = normalizeProcessType(proc);
  const tipoBase = getProcessBaseType(tipoNormalizado);
  return {
    tipoBase,
    tipoKey: normalizeTipoKey(tipoBase),
    tipoDisplay: getTipoDisplay(tipoBase),
  };
};

export default function ProcessosScreen({
  processosNormalizados,
  modoFoco,
  soAlertas,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
}) {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    return localStorage.getItem("processos.viewMode") || "cards";
  });
  const [sortField, setSortField] = useState(DEFAULT_SORT.value);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT.defaultDir);
  const [selectedTipo, setSelectedTipo] = useState("TODOS");
  const [expandedObs, setExpandedObs] = useState({});
  const [obsDrawer, setObsDrawer] = useState({ open: false, processo: null });
  const [obsDraft, setObsDraft] = useState("");
  const [obsHistory, setObsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsOverrides, setObsOverrides] = useState({});
  const [historyError, setHistoryError] = useState(null);

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
      if (!processo?.id) return;
      setObsDrawer({ open: true, processo });
      setObsDraft(obsOverrides[processo.id] ?? processo.obs ?? "");
      fetchObsHistory(processo.id);
    },
    [fetchObsHistory, obsOverrides],
  );

  const closeObsDrawer = useCallback(() => {
    setObsDrawer({ open: false, processo: null });
    setObsHistory([]);
    setHistoryError(null);
  }, []);

  const saveObs = useCallback(async () => {
    if (!obsDrawer?.processo?.id) return;
    setSavingObs(true);
    try {
      await fetchJson(`/api/v1/processos/${obsDrawer.processo.id}/obs`, {
        method: "PATCH",
        body: { obs: obsDraft },
      });
      setObsOverrides((prev) => ({ ...prev, [obsDrawer.processo.id]: obsDraft }));
      await fetchObsHistory(obsDrawer.processo.id);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao salvar OBS.");
    } finally {
      setSavingObs(false);
    }
  }, [fetchObsHistory, obsDraft, obsDrawer?.processo?.id]);

  const resolveObsValue = useCallback(
    (proc) => obsOverrides[proc?.id] ?? proc?.obs,
    [obsOverrides],
  );

  const processosEnriquecidos = useMemo(() => {
    return processosVisiveis.map((proc) => {
      const { tipoBase, tipoKey, tipoDisplay } = resolveTipoFromProcess(proc);
      return {
        ...proc,
        tipoBase,
        tipoKey,
        tipoDisplay,
        diversosOperacaoLabel: tipoBase === "Diversos" ? getDiversosOperacaoLabel(proc.operacao) : undefined,
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

  const { tableColumns, columnMetaMap } = useMemo(() => {
    const extras = selectedTipo === "TODOS" ? [] : extraColumnsByTipo[selectedTipo] ?? [];
    const tipoCol = selectedTipo === "TODOS" ? [{ id: "tipoDisplay", label: "Tipo" }] : [];
    const columns = [...tipoCol, ...baseColumns, ...extras];

    const map = columns.reduce((acc, column) => {
      acc[column.id] = column;
      return acc;
    }, {});

    SORT_OPTIONS.forEach((option) => {
      map[option.value] = { ...map[option.value], ...option };
    });

    return { tableColumns: columns, columnMetaMap: map };
  }, [selectedTipo]);

  const processosOrdenados = useMemo(() => {
    const filtered =
      selectedTipo === "TODOS"
        ? processosEnriquecidos
        : processosEnriquecidos.filter((proc) => proc.tipoKey === selectedTipo);

    const comparator = (a, b) => {
      const primary = compareProcessos(
        a,
        b,
        sortField,
        sortDir,
        columnMetaMap[sortField] ?? {},
      );
      if (primary !== 0) return primary;

      const defaultMeta = columnMetaMap[DEFAULT_SORT.value] ?? DEFAULT_SORT;
      const fallbackDefault = compareProcessos(
        a,
        b,
        DEFAULT_SORT.value,
        DEFAULT_SORT.defaultDir,
        defaultMeta,
      );
      if (fallbackDefault !== 0) return fallbackDefault;

      const secondaryMeta = columnMetaMap[SECONDARY_SORT.value] ?? SECONDARY_SORT;
      return compareProcessos(
        a,
        b,
        SECONDARY_SORT.value,
        SECONDARY_SORT.defaultDir,
        secondaryMeta,
      );
    };

    return [...filtered].sort(comparator);
  }, [columnMetaMap, processosEnriquecidos, selectedTipo, sortDir, sortField]);

  const resolveDefaultSortDir = useCallback(
    (field) => SORT_OPTIONS.find((option) => option.value === field)?.defaultDir ?? "asc",
    [],
  );

  const handleSortClick = (field, preferDefaultFirst = false) => {
    const defaultDir = resolveDefaultSortDir(field);

    if (sortField === field) {
      if (
        field === DEFAULT_SORT.value &&
        sortDir === DEFAULT_SORT.defaultDir &&
        !preferDefaultFirst
      ) {
        setSortDir("asc");
        return;
      }

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
                      isActive && "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm",
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
                      isActive
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-800",
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
              Ordenar por
            </span>
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
                      isActive && "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm",
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
              <Table className="min-w-[1080px]">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                  <TableRow>
                    {tableColumns.map((column) => {
                      const isActive = sortField === column.id;
                      const icon = !isActive ? (
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-indigo-500" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />
                      );

                      return (
                        <TableHead
                          key={column.id}
                          className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                        >
                          <button
                            type="button"
                            onClick={() => handleSortClick(column.id)}
                            className="flex w-full items-center gap-2 text-left text-slate-700 transition hover:text-slate-900"
                          >
                            <span className="cursor-pointer select-none">{column.label}</span>
                            {icon}
                          </button>
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
                    return (
                      <TableRow
                        key={getProcessKey(proc, index)}
                        className="border-b border-slate-100 hover:bg-slate-50/60"
                      >
                        {tableColumns.map((column) => {
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
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 transition hover:text-indigo-800"
                                >
                                  {maskedCnpj || "—"}
                                  <Clipboard className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            );
                          } else if (column.id === "protocolo") {
                            content = normalizeIdentifier(proc?.protocolo) || "—";
                          } else if (column.isDate) {
                            content = formatProcessDate(proc?.[column.id]);
                          } else if (column.id === "municipio") {
                            content = municipio || "—";
                          } else if (column.id === "situacao" || column.isStatus) {
                            content = renderStatus(proc?.[column.id]);
                          } else if (column.id === "obs") {
                            content = (
                              <button
                                type="button"
                                onClick={() => openObsDrawer(proc)}
                                className="inline-flex w-full max-w-xs items-start gap-2 text-left text-slate-700 transition-colors hover:text-slate-900"
                              >
                                {renderObsSnippet(obsValue)}
                              </button>
                            );
                          } else if (column.id === "area_m2") {
                            const area = normalizeText(proc?.area_m2).trim();
                            content = area ? `${area} m²` : "—";
                          } else if (column.id === "operacao") {
                            content = renderChip(proc?.operacao || proc?.diversosOperacaoLabel);
                          } else if (column.id === "orgao") {
                            content = renderChip(proc?.orgao);
                          } else if (column.id === "alvara") {
                            content = renderChip(proc?.alvara);
                          } else if (column.id === "servico") {
                            content = renderChip(proc?.servico);
                          } else if (column.id === "notificacao") {
                            content = renderChip(proc?.notificacao);
                          } else if (column.id === "tpi_sync_status") {
                            content = renderStatus(proc?.tpi_sync_status ?? proc?.tpi);
                          } else if (column.id === "taxa_sanitaria_sync_status") {
                            content = renderStatus(proc?.taxa_sanitaria_sync_status ?? proc?.taxa);
                          } else if (column.id === "alvara_sanitario_status") {
                            content = renderStatus(proc?.alvara_sanitario_status);
                          } else if (column.id === "alvara_sanitario_validade") {
                            content = formatProcessDate(proc?.alvara_sanitario_validade);
                          } else if (column.id === "inscricao_imobiliaria") {
                            content = normalizeIdentifier(proc?.inscricao_imobiliaria) || "—";
                          }

                          return (
                            <TableCell
                              key={column.id}
                              className="min-w-[140px] align-top px-4 py-3 text-xs text-slate-700"
                            >
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
              const obsKey = proc?.id ?? proc?.protocolo ?? `${proc.empresa}-${index}`;
              const isObsExpanded = !!expandedObs[obsKey];
              const hasLongObs = obsText.length > 140;
              const municipio = formatMunicipio(proc);
              const tipoKey = normKey(proc?.tipo);
              const tipoCls = tipoBadge[tipoKey] ?? `${badgeBase} bg-slate-50 text-slate-700 ring-slate-200`;
              const maskedCnpj = maskCNPJ(proc?.cnpj);

              const specificFields = [];

              if (normalizeText(proc?.operacao || proc?.diversosOperacaoLabel).trim()) {
                specificFields.push({
                  key: "operacao",
                  label: "Operação",
                  content: (
                    <InfoPill>{proc.diversosOperacaoLabel || proc.operacao}</InfoPill>
                  ),
                });
              }

              if (normalizeText(proc?.orgao).trim()) {
                specificFields.push({
                  key: "orgao",
                  label: "Órgão",
                  content: <InfoPill>{proc.orgao}</InfoPill>,
                });
              }

              if (normalizeText(proc?.alvara).trim()) {
                specificFields.push({
                  key: "alvara",
                  label: "Alvará",
                  content: <InfoPill>{proc.alvara}</InfoPill>,
                });
              }

              if (normalizeText(proc?.servico).trim()) {
                specificFields.push({
                  key: "servico",
                  label: "Serviço",
                  content: <InfoPill>{proc.servico}</InfoPill>,
                });
              }

              if (normalizeText(proc?.notificacao).trim()) {
                specificFields.push({
                  key: "notificacao",
                  label: "Notificação",
                  content: <InfoPill>{proc.notificacao}</InfoPill>,
                });
              }

              if (proc?.tipoKey === "BOMBEIROS") {
                const area = normalizeText(proc?.area_m2).trim();
                const projeto = normalizeText(proc?.projeto).trim();
                specificFields.push({
                  key: "area_m2",
                  label: "Área (m²)",
                  content: area ? `${area} m²` : "—",
                });
                if (projeto) {
                  specificFields.push({ key: "projeto", label: "Projeto", content: projeto });
                }
                specificFields.push({
                  key: "tpi_sync_status",
                  label: "TPI",
                  content: renderStatus(proc?.tpi_sync_status ?? proc?.tpi),
                });
              }

              if (proc?.tipoBase === "Uso do Solo" || proc?.tipoKey === "USO_DO_SOLO") {
                specificFields.push({
                  key: "inscricao_imobiliaria",
                  label: "Inscrição imobiliária",
                  content: normalizeIdentifier(proc?.inscricao_imobiliaria) || "—",
                });
              }

              if (
                proc?.tipoBase === "Sanitário" ||
                proc?.tipoBase === "Alvará Sanitário" ||
                proc?.tipoKey === "SANITARIO" ||
                proc?.tipoKey === "ALVARA_SANITARIO"
              ) {
                specificFields.push({
                  key: "taxa_sanitaria_sync_status",
                  label: "Taxa",
                  content: renderStatus(proc?.taxa_sanitaria_sync_status ?? proc?.taxa),
                });
                specificFields.push({
                  key: "alvara_sanitario_validade",
                  label: "Validade",
                  content: formatProcessDate(proc?.alvara_sanitario_validade),
                });
                specificFields.push({
                  key: "alvara_sanitario_status",
                  label: "Status validade",
                  content: renderStatus(proc?.alvara_sanitario_status),
                });
              }

              const Icon = PROCESS_TYPE_ICON[proc.tipoKey] || Settings;

              return (
                <Card
                  key={getProcessKey(proc, index)}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={tipoCls}>
                          <Icon className="h-4 w-4 text-slate-500" />
                          {proc.tipoDisplay}
                        </span>
                        <StatusBadge status={proc?.situacao || proc?.status || "Situação"} />
                      </div>
                      <p className="text-base font-semibold leading-tight text-slate-900">
                        {proc?.empresa || "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      {maskedCnpj && maskedCnpj !== "—" && (
                        <button
                          type="button"
                          onClick={() => {
                            const value = maskCNPJ(proc?.cnpj);
                            if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                          }}
                          className="text-[12px] font-semibold text-indigo-600 transition hover:text-indigo-800"
                        >
                          {maskedCnpj}
                        </button>
                      )}
                      {normalizeText(proc?.prazo).trim() && (
                        <InfoPill>Prazo {proc.prazo}</InfoPill>
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
                            <p
                              className={cn(
                                "text-sm leading-relaxed text-slate-700",
                                !isObsExpanded && "line-clamp-2",
                              )}
                            >
                              {obsText}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              {hasLongObs && (
                                <button
                                  type="button"
                                  onClick={() => toggleObsExpanded(obsKey)}
                                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
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
                              className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
                            >
                              Adicionar
                            </button>
                          </div>
                        )}
                      </InfoItem>

                      {specificFields.map((field) => (
                        <InfoItem key={field.key} label={field.label}>
                          {field.content}
                        </InfoItem>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Observações</p>
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
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
                      onClick={() => fetchObsHistory(obsDrawer.processo.id)}
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
                        key={entry.id || `${entry.changed_at}-${entry.old_obs?.length}`}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-inner"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDateTime(entry.changed_at)}</span>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Anterior</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.old_obs || "—"}>
                              {normalizeText(entry.old_obs).trim() || "—"}
                            </p>
                          </div>
                          <div className="hidden items-center justify-center md:flex">
                            <MoveRight className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atual</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.new_obs || "—"}>
                              {normalizeText(entry.new_obs).trim() || "—"}
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
