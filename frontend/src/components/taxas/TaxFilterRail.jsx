import React from "react";
import { Button } from "@/components/ui/button";

export default function TaxFilterRail({
  taxasGlobaisLength,
  railActiveCount,
  RailFilterBlock,
  STATUS_FILTER_OPTIONS,
  WORK_QUEUE_ITEMS,
  summaryFilter,
  setSummaryFilter,
  queueFilter,
  setQueueFilter,
  localSearchScopedLength,
  queueCounts,
  chipClass,
  railFilters,
  setRailFilters,
  DEFAULT_RISK_KEYS,
  RISK_OPTIONS,
  toggleRailFilter,
  DEFAULT_CERT_BUCKETS,
  CERT_OPTIONS,
  municipioOptions,
  clearRailFilters,
}) {
  return (
    <aside className="hidden xl:block xl:self-start xl:sticky xl:top-0 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
            <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
            <p className="text-xs text-slate-500">Registros no recorte: {taxasGlobaisLength}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
            <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
            <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
          </div>
        </div>

        <div className="space-y-3">
          <RailFilterBlock label="Filtros rápidos">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button key={option.value} type="button" onClick={() => setSummaryFilter(option.value)} className={chipClass(summaryFilter === option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {WORK_QUEUE_ITEMS.map((item) => (
                <button key={item.key} type="button" onClick={() => setQueueFilter(item.key)} className={chipClass(queueFilter === item.key)}>
                  {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{item.key === "all" ? localSearchScopedLength : queueCounts[item.key] || 0}</span>
                </button>
              ))}
            </div>
          </RailFilterBlock>

          <RailFilterBlock label="Status da empresa">
            <div className="flex flex-wrap gap-2">
              {["Ativas", "Inativas", "Todas"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRailFilters((prev) => ({ ...prev, companyStatus: value }))}
                  className={chipClass(railFilters.companyStatus === value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </RailFilterBlock>
          <RailFilterBlock label="Risco CNAE">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRailFilters((prev) => ({ ...prev, riskKeys: [...DEFAULT_RISK_KEYS] }))} className={chipClass(railFilters.riskKeys.length === DEFAULT_RISK_KEYS.length)}>
                Todos
              </button>
              {RISK_OPTIONS.map((option) => {
                const active = railFilters.riskKeys.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleRailFilter(option.key, "riskKeys", DEFAULT_RISK_KEYS)}
                    className={chipClass(active)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </RailFilterBlock>
          <RailFilterBlock label="Certificado">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRailFilters((prev) => ({ ...prev, certBuckets: [...DEFAULT_CERT_BUCKETS] }))} className={chipClass(railFilters.certBuckets.length === DEFAULT_CERT_BUCKETS.length)}>
                Todos
              </button>
              {CERT_OPTIONS.map((option) => {
                const active = railFilters.certBuckets.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleRailFilter(option.key, "certBuckets", DEFAULT_CERT_BUCKETS)}
                    className={chipClass(active)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </RailFilterBlock>
          <RailFilterBlock label="Município">
            {municipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {municipioOptions.map((item) => (
                <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={railFilters.municipio.includes(item)}
                    onChange={() =>
                      setRailFilters((prev) => ({
                        ...prev,
                        municipio: prev.municipio.includes(item)
                          ? prev.municipio.filter((entry) => entry !== item)
                          : [...prev.municipio, item],
                      }))
                    }
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </RailFilterBlock>
          <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
            <div className="relative h-6">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
              <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${railFilters.urgencyMin}%`, width: `${Math.max(0, railFilters.urgencyMax - railFilters.urgencyMin)}%` }} />
              <input
                type="range"
                min={0}
                max={100}
                value={railFilters.urgencyMin}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setRailFilters((prev) => ({ ...prev, urgencyMin: Math.min(value, prev.urgencyMax) }));
                }}
                className="ec-urgency-range"
                aria-label="Score de urgência mínimo"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={railFilters.urgencyMax}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setRailFilters((prev) => ({ ...prev, urgencyMax: Math.max(value, prev.urgencyMin) }));
                }}
                className="ec-urgency-range"
                aria-label="Score de urgência máximo"
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{railFilters.urgencyMin}</span><span>{railFilters.urgencyMax}</span></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearRailFilters}>
              Limpar
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

