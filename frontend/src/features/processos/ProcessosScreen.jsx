import React, { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  buildDiversosOperacaoKey,
  formatProcessDate,
  getDiversosOperacaoLabel,
  getProcessBaseType,
  normalizeProcessType,
} from "@/lib/process";
import { normalizeIdentifier, normalizeText } from "@/lib/text";
import { isProcessStatusActiveOrPending } from "@/lib/status";
import { fetchJson } from "@/lib/api";

const PROCESS_TYPE_DISPLAY = {
  BOMBEIROS: "CERCON",
  FUNCIONAMENTO: "Funcionamento",
  DIVERSOS: "Diversos",
  USO_DO_SOLO: "Uso do Solo",
  SANITARIO: "Sanitário",
};

const PROCESS_TYPE_ICON = {
  BOMBEIROS: Settings,
  FUNCIONAMENTO: Settings,
  DIVERSOS: Settings,
  USO_DO_SOLO: MapPin,
  SANITARIO: Settings,
};

const normalizeTipoKey = (tipoBase) =>
  normalizeText(tipoBase ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const baseColumns = [
  { id: "empresa", label: "Empresa", sortable: true },
  { id: "protocolo", label: "Protocolo", sortable: true },
  { id: "data_solicitacao", label: "Data solicitação", sortable: true, isDate: true },
  { id: "municipio", label: "Município", sortable: true },
  { id: "situacao", label: "Situação", sortable: true, isStatus: true },
  { id: "obs", label: "OBS", sortable: true },
];

const extraColumnsByTipo = {
  DIVERSOS: [
    { id: "operacao", label: "Operação", sortable: true },
    { id: "orgao", label: "Órgão", sortable: true },
  ],
  FUNCIONAMENTO: [{ id: "alvara", label: "Alvará", sortable: true }],
  BOMBEIROS: [
    { id: "area_m2", label: "Área (m²)", sortable: true },
    { id: "projeto", label: "Projeto", sortable: true },
    { id: "tpi_sync_status", label: "TPI", sortable: true, isStatus: true },
  ],
  USO_DO_SOLO: [
    { id: "inscricao_imobiliaria", label: "Inscrição imobiliária", sortable: true },
  ],
  SANITARIO: [
    { id: "servico", label: "Serviço", sortable: true },
    { id: "taxa_sanitaria_sync_status", label: "Taxa", sortable: true, isStatus: true },
    { id: "notificacao", label: "Notificação", sortable: true },
    {
      id: "alvara_sanitario_validade",
      label: "Validade",
      sortable: true,
      isDate: true,
      isDateOnly: true,
    },
    { id: "alvara_sanitario_status", label: "Status validade", sortable: true, isStatus: true },
  ],
};

const sortDirectionCycle = {
  undefined: "asc",
  asc: "desc",
  desc: undefined,
};

const extractDateValue = (value) => {
  const normalized = normalizeText(value).trim();
  if (!normalized) return null;
  const parsed = dayjs(normalized, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (parsed.isValid()) return parsed.valueOf();
  const fallback = dayjs(normalized);
  return fallback.isValid() ? fallback.valueOf() : null;
};

const toggleSort = (currentState, tipoKey, columnId) => {
  const current = currentState[tipoKey];
  const nextDirection = sortDirectionCycle[current?.column === columnId ? current.direction : undefined];
  return {
    ...currentState,
    [tipoKey]: nextDirection
      ? {
          column: columnId,
          direction: nextDirection,
        }
      : undefined,
  };
};

const getComparator = (column) => {
  if (!column) return null;
  if (column.isDate) {
    return (proc) => extractDateValue(proc?.[column.id]);
  }
  return (proc) => normalizeText(proc?.[column.id]).trim();
};

const sortRows = (rows, sortState, columns) => {
  if (!sortState?.column) return rows;
  const column = columns.find((col) => col.id === sortState.column);
  const accessor = getComparator(column);
  if (!accessor) return rows;

  const direction = sortState.direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const aValue = accessor(a);
    const bValue = accessor(b);

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * direction;
    }

    return aValue.localeCompare(bValue) * direction;
  });
};

const renderSortIcon = (isActive, direction) => {
  if (!isActive) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  if (direction === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
  if (direction === "desc") return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
};

const formatDateTime = (value) => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY HH:mm");
};

const renderObsSnippet = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const snippet = text.length > 80 ? `${text.slice(0, 77)}…` : text;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600">
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="line-clamp-2 text-left leading-snug">{snippet}</span>
    </div>
  );
};

const renderStatus = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return <StatusBadge status={text} />;
};

const renderCompany = (proc, handleCopy) => (
  <div className="space-y-0.5">
    <p className="text-sm font-semibold text-slate-800 leading-tight">
      {proc?.empresa || "—"}
    </p>
    <button
      type="button"
      onClick={() => {
        const value = normalizeIdentifier(proc?.cnpj);
        if (value) handleCopy(value, `CNPJ copiado: ${value}`);
      }}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {normalizeIdentifier(proc?.cnpj) || "—"}
      <Clipboard className="h-3 w-3" aria-hidden="true" />
    </button>
  </div>
);

const renderMunicipio = (proc) => {
  const municipio = normalizeText(proc?.municipio_exibicao || proc?.municipio).trim();
  if (!municipio) return "—";
  return (
    <div className="inline-flex items-center gap-1 text-xs text-slate-700">
      <MapPin className="h-3.5 w-3.5 text-slate-400" />
      <span>{municipio}</span>
    </div>
  );
};

const renderChip = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return (
    <Chip variant="neutral" className="bg-slate-100 text-slate-700 border-slate-200 text-[11px]">
      {text}
    </Chip>
  );
};

const getTipoDisplay = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return PROCESS_TYPE_DISPLAY[key] ?? tipoBase ?? "Processo";
};

const resolveExtraColumns = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return extraColumnsByTipo[key] ?? [];
};

export default function ProcessosScreen({
  processosNormalizados,
  modoFoco,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
}) {
  const [sortByTipo, setSortByTipo] = useState({});
  const [obsDrawer, setObsDrawer] = useState({ open: false, processo: null });
  const [obsDraft, setObsDraft] = useState("");
  const [obsHistory, setObsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsOverrides, setObsOverrides] = useState({});
  const [historyError, setHistoryError] = useState(null);

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

      return matchesMunicipio && matchesBusca && matchesFoco;
    });
  }, [matchesMunicipioFilter, matchesQuery, modoFoco, processosNormalizados]);

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

  const processosByTipo = useMemo(() => {
    const groups = new Map();

    processosVisiveis.forEach((proc) => {
      const tipoNormalizado = normalizeProcessType(proc);
      const tipoBase = getProcessBaseType(tipoNormalizado);
      const key = normalizeTipoKey(tipoBase);
      const entry = groups.get(key) || {
        key,
        display: getTipoDisplay(tipoBase),
        tipoBase,
        registros: [],
      };
      entry.registros.push({
        ...proc,
        tipoBase,
        diversosOperacaoKey:
          tipoBase === "Diversos" ? buildDiversosOperacaoKey(proc.operacao) : undefined,
        diversosOperacaoLabel:
          tipoBase === "Diversos" ? getDiversosOperacaoLabel(proc.operacao) : undefined,
      });
      groups.set(key, entry);
    });

    return Array.from(groups.values()).sort((a, b) => a.display.localeCompare(b.display));
  }, [processosVisiveis]);

  return (
    <>
      <div className="mt-4 space-y-3">
        {processosByTipo.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nenhum processo correspondente ao filtro.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {processosByTipo.map((tipo) => {
              const Icon = PROCESS_TYPE_ICON[tipo.key] || Settings;
              const columns = [...baseColumns, ...resolveExtraColumns(tipo.tipoBase)];
              const sortState = sortByTipo[tipo.key];
              const registrosOrdenados = sortRows(tipo.registros, sortState, columns);

              return (
                <Card
                  key={tipo.key}
                  className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{tipo.display}</span>
                      <InlineBadge variant="outline" className="bg-white text-slate-600">
                        {registrosOrdenados.length}
                      </InlineBadge>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 p-0">
                    <div className="flex-1 overflow-auto px-0">
                      <div className="w-max min-w-full">
                        <Table className="w-max min-w-full">
                          <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200">
                            <TableRow className="shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                              {columns.map((col) => {
                                const isActive = sortState?.column === col.id;
                                const direction = isActive ? sortState?.direction : undefined;

                                return (
                                  <TableHead
                                    key={col.id}
                                    className="whitespace-nowrap px-4 py-3 align-middle text-xs font-semibold uppercase tracking-wide text-slate-600"
                                  >
                                    {col.sortable ? (
                                      <button
                                        type="button"
                                        onClick={() => setSortByTipo((state) => toggleSort(state, tipo.key, col.id))}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:text-slate-900"
                                      >
                                        {col.label}
                                        {renderSortIcon(isActive, direction)}
                                      </button>
                                    ) : (
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                        {col.label}
                                      </span>
                                    )}
                                  </TableHead>
                                );
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {registrosOrdenados.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={columns.length} className="text-sm text-slate-500">
                                  Nenhum registro para este tipo.
                                </TableCell>
                              </TableRow>
                            ) : (
                              registrosOrdenados.map((proc, index) => (
                                <TableRow
                                  key={`${tipo.key}-${proc.empresa_id ?? proc.empresa}-${proc.protocolo ?? index}`}
                                  className="hover:bg-slate-50/60"
                                >
                                  {columns.map((col) => {
                                    let content = normalizeText(proc?.[col.id]).trim() || "—";
                                    const resolvedObs = resolveObsValue(proc);

                                    if (col.id === "empresa") {
                                      content = renderCompany(proc, handleCopy);
                                    } else if (col.id === "protocolo") {
                                      content = normalizeIdentifier(proc?.protocolo) || "—";
                                    } else if (col.isDate) {
                                      content = formatProcessDate(proc?.[col.id]);
                                    } else if (col.id === "municipio") {
                                      content = renderMunicipio(proc);
                                    } else if (col.id === "situacao" || col.isStatus) {
                                      content = renderStatus(proc?.[col.id]);
                                    } else if (col.id === "obs") {
                                      content = (
                                        <button
                                          type="button"
                                          onClick={() => openObsDrawer(proc)}
                                          className="inline-flex w-full max-w-xs items-start gap-2 text-left text-slate-700 transition-colors hover:text-slate-900"
                                        >
                                          {renderObsSnippet(resolvedObs)}
                                        </button>
                                      );
                                    } else if (col.id === "area_m2") {
                                      const area = normalizeText(proc?.area_m2).trim();
                                      content = area ? `${area} m²` : "—";
                                    } else if (col.id === "operacao") {
                                      content = renderChip(proc?.operacao || proc?.diversosOperacaoLabel);
                                    } else if (col.id === "orgao") {
                                      content = renderChip(proc?.orgao);
                                    } else if (col.id === "alvara") {
                                      content = renderChip(proc?.alvara);
                                    } else if (col.id === "servico") {
                                      content = renderChip(proc?.servico);
                                    } else if (col.id === "notificacao") {
                                      content = renderChip(proc?.notificacao);
                                    } else if (col.id === "tpi_sync_status") {
                                      content = renderStatus(proc?.tpi_sync_status ?? proc?.tpi);
                                    } else if (col.id === "taxa_sanitaria_sync_status") {
                                      content = renderStatus(proc?.taxa_sanitaria_sync_status ?? proc?.taxa);
                                    } else if (col.id === "alvara_sanitario_status") {
                                      content = renderStatus(proc?.alvara_sanitario_status);
                                    } else if (col.id === "alvara_sanitario_validade") {
                                      content = formatProcessDate(proc?.alvara_sanitario_validade);
                                    } else if (col.id === "inscricao_imobiliaria") {
                                      content = normalizeIdentifier(proc?.inscricao_imobiliaria) || "—";
                                    }

                                    return (
                                      <TableCell key={col.id} className="align-top text-xs text-slate-700">
                                        {content}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
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
