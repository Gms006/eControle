import React, { useCallback, useMemo } from "react";
import InlineBadge from "@/components/InlineBadge";
import { AlertTriangle, ArrowDown, ArrowUp, LayoutGrid, List } from "lucide-react";
import { formatProcessDate, getDiversosOperacaoLabel } from "@/lib/process";
import { formatCanonicalLabel, normalizeIdentifier, normalizeText } from "@/lib/text";
import { maskCNPJ } from "@/lib/format";
import { formatStatusDisplay, resolveStatusClass } from "@/lib/domain/status/display";
import { cn } from "@/lib/utils";
import { buildCertificadoIndex, resolveEmpresaCertificadoSituacao } from "@/lib/certificados";
import { getPriorityTypeFields, getTypeFields } from "@/lib/processTypeFields";
import { getProcessUrgency, URGENCY_BUCKETS } from "@/lib/processUrgency";
import {
  compareProcessos,
  formatMunicipio,
  getCertBucketKey,
  getCompanyRiskKey,
  getCompanyStatusKey,
  getProcessKey,
  getTipoDisplay,
  isUrgentByStatus,
  resolveProcessId,
  resolveTipoFromProcess,
} from "@/lib/domain/adapters/processos";
import { buildCompanyIndex } from "@/lib/domain/indexes/companyIndex";
import DomainSubnav from "@/components/navigation/DomainSubnav";
import ProcessFilterRail from "@/components/processos/ProcessFilterRail";
import ProcessTable from "@/components/processos/ProcessTable";
import ProcessCardGrid from "@/components/processos/ProcessCardGrid";
import ProcessSummaryCards from "@/components/processos/ProcessSummaryCards";
import ProcessDetailsDrawer from "@/components/processos/ProcessDetailsDrawer";
import ProcessObsDrawer from "@/components/processos/ProcessObsDrawer";
import { getProcessRailChipClass, ProcessRailFilterBlock } from "@/components/processos/ProcessFilterPrimitives";
import {
  CERT_OPTIONS,
  DEFAULT_SORT,
  PROCESS_TYPE_ICON,
  RISK_OPTIONS,
  SECONDARY_SORT,
  SORT_OPTIONS,
  TABLE_COLUMNS,
} from "@/components/processos/processTableConfig";
import { abbreviateProcessStatus, formatProcessDateTime } from "@/components/processos/processDisplayFormatters";
import { renderProcessFieldValue } from "@/components/processos/processFieldRenderers";
import { renderProcessObsSnippet, renderProcessStatus } from "@/components/processos/processRenderers";
import useProcessFilterMeta from "@/hooks/processos/useProcessFilterMeta";
import useProcessViewState from "@/hooks/processos/useProcessViewState";
import useVisibleProcesses from "@/hooks/processos/useVisibleProcesses";
import useProcessQueue from "@/hooks/processos/useProcessQueue";
import useProcessRailFilters from "@/hooks/processos/useProcessRailFilters";
import useProcessSorting from "@/hooks/processos/useProcessSorting";
import useProcessRows from "@/hooks/processos/useProcessRows";
import useProcessObsHistory from "@/hooks/processos/useProcessObsHistory";
import useProcessSummary from "@/hooks/processos/useProcessSummary";
import useProcessTypeGroups from "@/hooks/processos/useProcessTypeGroups";
import useProcessMunicipios from "@/hooks/processos/useProcessMunicipios";
import useProcessByType from "@/hooks/processos/useProcessByType";
import useProcessColumnMeta from "@/hooks/processos/useProcessColumnMeta";
import useProcessRailResult from "@/hooks/processos/useProcessRailResult";

export default function ProcessosScreen({
  processosNormalizados,
  empresas,
  certificados,
  modoFoco,
  soAlertas,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
  panelPreset,
  activeTab = "processos",
  onTabChange,
  query = "",
  onQueryChange,
  municipio = "Todos",
  searchField = "all",
  canManageProcessos = false,
}) {
  const empresasList = Array.isArray(empresas) ? empresas : [];
  const certificadosList = Array.isArray(certificados) ? certificados : [];
  const {
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
  } = useProcessViewState({
    panelPreset,
    defaultSort: DEFAULT_SORT,
  });

  const openEditProcesso = useCallback((processId) => {
    if (!processId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-process", {
        detail: { mode: "edit", processId },
      }),
    );
  }, []);

  const companyIndex = useMemo(() => buildCompanyIndex(empresasList), [empresasList]);

  const certificadoIndex = useMemo(
    () => buildCertificadoIndex(certificadosList),
    [certificadosList],
  );

  const processosVisiveis = useVisibleProcesses({
    processosNormalizados,
    matchesMunicipioFilter,
    matchesQuery,
    modoFoco,
    soAlertas,
  });

  const {
    obsDrawer,
    obsDraft,
    setObsDraft,
    obsHistory,
    loadingHistory,
    savingObs,
    historyError,
    fetchObsHistory,
    openObsDrawer,
    closeObsDrawer,
    saveObs,
    resolveObsValue,
  } = useProcessObsHistory({ resolveProcessId });

  const processosEnriquecidos = useProcessRows({
    processosVisiveis,
    resolveTipoFromProcess,
    getDiversosOperacaoLabel,
    companyIndex,
    getCompanyStatusKey,
    getCompanyRiskKey,
    resolveEmpresaCertificadoSituacao,
    certificadoIndex,
    getCertBucketKey,
    getProcessUrgency,
  });

  const situacaoResumo = useProcessSummary(processosEnriquecidos);

  const tiposDisponiveis = useProcessTypeGroups(processosEnriquecidos);

  const municipiosDisponiveis = useProcessMunicipios(processosEnriquecidos);

  const processosPorTipo = useProcessByType(processosEnriquecidos, selectedTipo);

  const processosRailFiltrados = useProcessRailResult({
    processosPorTipo,
    companyStatusFilters,
    riskFilters,
    certFilters,
    municipioFilters,
    urgencyMin,
    urgencyMax,
  });

  const columnMetaMap = useProcessColumnMeta(TABLE_COLUMNS);

  const { urgencyCounts, processosOrdenados } = useProcessQueue({
    processosRailFiltrados,
    isUrgentByStatus,
    urgencyBuckets: URGENCY_BUCKETS,
    queueMode,
    selectedUrgencyBucket,
    sortField,
    sortDir,
    sortOptions: SORT_OPTIONS,
    columnMetaMap,
    compareProcessos,
    defaultSort: DEFAULT_SORT,
    secondarySort: SECONDARY_SORT,
  });

  const { activeFilterChips, railActiveCount } = useProcessFilterMeta({
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
    riskOptionsLength: RISK_OPTIONS.length,
    certOptionsLength: CERT_OPTIONS.length,
  });

  const { handleSortClick } = useProcessSorting({
    sortOptions: SORT_OPTIONS,
    sortField,
    setSortField,
    setSortDir,
  });

  const openDetailsDrawer = useCallback((processo) => {
    setDetailsDrawer({ open: true, processo });
  }, []);

  const detailsFields = useMemo(
    () => (detailsDrawer.processo ? getTypeFields(detailsDrawer.processo) : []),
    [detailsDrawer.processo],
  );

  const { toggleArrayFilter, toggleCompanyStatusFilter, clearRailFilters } = useProcessRailFilters({
    setCompanyStatusFilters,
    setRiskFilters,
    setCertFilters,
    setMunicipioFilters,
    setUrgencyMin,
    setUrgencyMax,
    riskOptions: RISK_OPTIONS,
    certOptions: CERT_OPTIONS,
  });

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <ProcessFilterRail
          railActiveCount={railActiveCount}
          processosRailFiltradosLength={processosRailFiltrados.length}
          queueMode={queueMode}
          setQueueMode={setQueueMode}
          selectedUrgencyBucket={selectedUrgencyBucket}
          setSelectedUrgencyBucket={setSelectedUrgencyBucket}
          urgencyCounts={urgencyCounts}
          URGENCY_BUCKETS={URGENCY_BUCKETS}
          RailFilterBlock={ProcessRailFilterBlock}
          railChipClass={getProcessRailChipClass}
          companyStatusFilters={companyStatusFilters}
          toggleCompanyStatusFilter={toggleCompanyStatusFilter}
          RISK_OPTIONS={RISK_OPTIONS}
          setRiskFilters={setRiskFilters}
          riskFilters={riskFilters}
          toggleArrayFilter={toggleArrayFilter}
          CERT_OPTIONS={CERT_OPTIONS}
          setCertFilters={setCertFilters}
          certFilters={certFilters}
          setMunicipioFilters={setMunicipioFilters}
          municipioFilters={municipioFilters}
          municipiosDisponiveis={municipiosDisponiveis}
          urgencyMin={urgencyMin}
          urgencyMax={urgencyMax}
          setUrgencyMin={setUrgencyMin}
          setUrgencyMax={setUrgencyMax}
          clearRailFilters={clearRailFilters}
        />

        <div className="space-y-4 min-w-0">
        <DomainSubnav activeTab={activeTab} onTabChange={onTabChange} />

        <div className="flex flex-wrap gap-2">
          {activeFilterChips.length > 0 ? (
            activeFilterChips.map((chip) => (
              <span key={chip} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                {chip}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
              Sem filtros persistentes ativos
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ProcessSummaryCards situacaoResumo={situacaoResumo} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {tiposDisponiveis.map((tipo) => {
                const isActive = selectedTipo === tipo.key;
                const Icon = PROCESS_TYPE_ICON[tipo.key] || PROCESS_TYPE_ICON.DIVERSOS;
                return (
                  <button
                    key={tipo.key}
                    type="button"
                    onClick={() => setSelectedTipo(tipo.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {tipo.key !== "TODOS" ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
                    <span>{tipo.display}</span>
                    {tipo.key === "TODOS" ? (
                      <span className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                        {tipo.count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{tipo.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn("rounded-md p-2 transition", viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}
                  title="Visualização em tabela"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn("rounded-md p-2 transition", viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}
                  title="Visualização em cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  queueMode === "all"
                    ? "border-slate-200 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setQueueMode("urgent")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-1 py-1 text-sm font-medium transition",
                  queueMode === "urgent"
                    ? "border-transparent bg-transparent text-slate-700"
                    : "border-transparent bg-transparent text-slate-600 hover:text-slate-800",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Urgentes
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                  {urgencyCounts.all || 0}
                </span>
              </button>
            </div>
          </div>

          {queueMode === "urgent" && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {URGENCY_BUCKETS.map((bucket) => {
                  const isActive = selectedUrgencyBucket === bucket.key;
                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      onClick={() => setSelectedUrgencyBucket(bucket.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
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
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Ordenar por</span>
              <div className="flex flex-wrap items-center gap-2">
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortField === option.value;
                  const DirectionIcon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : null;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSortClick(option.value, true)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        "border-transparent bg-transparent text-slate-600 hover:text-slate-900",
                        isActive && "border-slate-900 bg-slate-900 text-white shadow-sm",
                      )}
                    >
                      <span>{option.label}</span>
                      {DirectionIcon ? <DirectionIcon className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="text-sm text-slate-400">{processosOrdenados.length} resultados</span>
          </div>
        </div>

        {processosOrdenados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nenhum processo correspondente ao filtro.
          </div>
        ) : viewMode === "table" ? (
          <ProcessTable
            processosOrdenados={processosOrdenados}
            TABLE_COLUMNS={TABLE_COLUMNS}
            sortField={sortField}
            sortDir={sortDir}
            handleSortClick={handleSortClick}
            formatMunicipio={formatMunicipio}
            resolveObsValue={resolveObsValue}
            maskCNPJ={maskCNPJ}
            getPriorityTypeFields={getPriorityTypeFields}
            getProcessKey={getProcessKey}
            normalizeText={normalizeText}
            normalizeIdentifier={normalizeIdentifier}
            formatProcessDate={formatProcessDate}
            renderStatus={renderProcessStatus}
            Chip={Chip}
            openDetailsDrawer={openDetailsDrawer}
            openEditProcesso={openEditProcesso}
            resolveProcessId={resolveProcessId}
            openObsDrawer={openObsDrawer}
            renderObsSnippet={renderProcessObsSnippet}
            handleCopy={handleCopy}
          />
        ) : (
          <ProcessCardGrid
            processosOrdenados={processosOrdenados}
            resolveObsValue={resolveObsValue}
            normalizeText={normalizeText}
            resolveProcessId={resolveProcessId}
            formatMunicipio={formatMunicipio}
            normalizeIdentifier={normalizeIdentifier}
            maskCNPJ={maskCNPJ}
            formatProcessDate={formatProcessDate}
            abbreviateProcessStatus={abbreviateProcessStatus}
            resolveStatusClass={resolveStatusClass}
            formatStatusDisplay={formatStatusDisplay}
            formatCanonicalLabel={formatCanonicalLabel}
            getProcessKey={getProcessKey}
            openEditProcesso={openEditProcesso}
            handleCopy={handleCopy}
            openObsDrawer={openObsDrawer}
          />
        )}
        </div>
      </div>

      <ProcessDetailsDrawer
        detailsDrawer={detailsDrawer}
        detailsFields={detailsFields}
        onClose={() => setDetailsDrawer({ open: false, processo: null })}
        renderFieldValue={renderProcessFieldValue}
      />

      <ProcessObsDrawer
        obsDrawer={obsDrawer}
        closeObsDrawer={closeObsDrawer}
        getTipoDisplay={getTipoDisplay}
        savingObs={savingObs}
        obsDraft={obsDraft}
        setObsDraft={setObsDraft}
        saveObs={saveObs}
        loadingHistory={loadingHistory}
        resolveProcessId={resolveProcessId}
        fetchObsHistory={fetchObsHistory}
        historyError={historyError}
        obsHistory={obsHistory}
        formatDateTime={formatProcessDateTime}
      />
    </>
  );
}



