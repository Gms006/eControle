import React from "react";

export default function ProcessFilterRail({
  railActiveCount,
  processosRailFiltradosLength,
  queueMode,
  setQueueMode,
  selectedUrgencyBucket,
  setSelectedUrgencyBucket,
  urgencyCounts,
  URGENCY_BUCKETS,
  RailFilterBlock,
  railChipClass,
  companyStatusFilters,
  toggleCompanyStatusFilter,
  RISK_OPTIONS,
  setRiskFilters,
  riskFilters,
  toggleArrayFilter,
  CERT_OPTIONS,
  setCertFilters,
  certFilters,
  setMunicipioFilters,
  municipioFilters,
  municipiosDisponiveis,
  urgencyMin,
  urgencyMax,
  setUrgencyMin,
  setUrgencyMax,
  clearRailFilters,
}) {
  return (
    <aside className="hidden xl:block xl:self-start xl:sticky xl:top-0 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
            <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
            <p className="text-xs text-slate-500">Registros no recorte: {processosRailFiltradosLength}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
            <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
            <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
          </div>
        </div>

        <div className="space-y-3">
          <RailFilterBlock label="Filtros rápidos">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setQueueMode("all"); setSelectedUrgencyBucket("all"); }} className={railChipClass(queueMode === "all")}>
                Todos <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{processosRailFiltradosLength}</span>
              </button>
              <button type="button" onClick={() => setQueueMode("urgent")} className={railChipClass(queueMode === "urgent")}>
                Urgentes <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{urgencyCounts.all || 0}</span>
              </button>
            </div>
            {queueMode === "urgent" ? (
              <div className="flex flex-wrap gap-2">
                {URGENCY_BUCKETS.map((bucket) => (
                  <button key={bucket.key} type="button" onClick={() => setSelectedUrgencyBucket(bucket.key)} className={railChipClass(selectedUrgencyBucket === bucket.key)}>
                    {bucket.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{bucket.key === "all" ? urgencyCounts.all || 0 : urgencyCounts[bucket.key] || 0}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </RailFilterBlock>

          <RailFilterBlock label="Status da empresa">
            <div className="flex flex-wrap gap-2">
              {["Ativas", "Sem vínculo", "Inativas", "Todas"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleCompanyStatusFilter(option)}
                  className={railChipClass(companyStatusFilters.includes(option))}
                >
                  {option}
                </button>
              ))}
            </div>
          </RailFilterBlock>

          <RailFilterBlock label="Risco CNAE">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRiskFilters(RISK_OPTIONS.map((item) => item.key))}
                className={railChipClass(riskFilters.length === RISK_OPTIONS.length)}
              >
                Todos
              </button>
              {RISK_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleArrayFilter(option.key, riskFilters, setRiskFilters, RISK_OPTIONS.map((item) => item.key))}
                  className={railChipClass(riskFilters.includes(option.key))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </RailFilterBlock>

          <RailFilterBlock label="Certificado">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCertFilters(CERT_OPTIONS.map((item) => item.key))}
                className={railChipClass(certFilters.length === CERT_OPTIONS.length)}
              >
                Todos
              </button>
              {CERT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleArrayFilter(option.key, certFilters, setCertFilters, CERT_OPTIONS.map((item) => item.key))}
                  className={railChipClass(certFilters.includes(option.key))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </RailFilterBlock>

          <RailFilterBlock label="Município">
            {municipiosDisponiveis.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {municipiosDisponiveis.map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={municipioFilters.includes(option)}
                    onChange={() =>
                      setMunicipioFilters((prev) =>
                        prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
                      )
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </RailFilterBlock>

          <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
            <div className="relative h-6">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
              <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${urgencyMin}%`, width: `${Math.max(0, urgencyMax - urgencyMin)}%` }} />
              <input type="range" min={0} max={100} value={urgencyMin} onChange={(event) => setUrgencyMin(Math.min(Number(event.target.value), urgencyMax))} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
              <input type="range" min={0} max={100} value={urgencyMax} onChange={(event) => setUrgencyMax(Math.max(Number(event.target.value), urgencyMin))} className="ec-urgency-range" aria-label="Score de urgência máximo" />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{urgencyMin}</span><span>{urgencyMax}</span></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={clearRailFilters}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
