import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CompaniesFilterRail({
  rowsCount,
  statusFilter,
  setStatusFilter,
  riskFilters,
  setRiskFilters,
  allRiskFilters,
  certFilters,
  setCertFilters,
  municipioFilters,
  setMunicipioFilters,
  municipioOptions,
  urgencyMin,
  urgencyMax,
  setUrgencyMin,
  setUrgencyMax,
  porteFilters,
  setPorteFilters,
  porteOptions,
  responsavelFilters,
  setResponsavelFilters,
  responsavelOptions,
  clearRailFilters,
  toggleMultiFilter,
  onRiskFilterClick,
  activeCount,
  kpis,
  counts,
  kpiFilter,
  setKpiFilter,
  includeRiskTestIds = false,
}) {
  const chipClass = (active) =>
    cn(
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white",
    );

  return (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
          <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
          <p className="text-xs text-slate-500">Empresas no recorte: {rowsCount}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
          <div className="text-sm font-semibold leading-4 text-blue-700">{activeCount}</div>
          <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{activeCount === 1 ? "ativo" : "ativos"}</div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {kpis.map((item) => {
            const active = kpiFilter === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setKpiFilter((prev) => (prev === item.key ? null : item.key))} className={chipClass(active)}>
                {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{counts[item.key] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
        <div className="flex flex-wrap gap-2">
          {["ativas", "inativas", "todas"].map((value) => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)} className={chipClass(statusFilter === value)}>
              {value === "ativas" ? "Ativas" : value === "inativas" ? "Inativas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={includeRiskTestIds ? "companies-risk-filter-todos" : undefined}
            onClick={() => setRiskFilters([...allRiskFilters])}
            className={chipClass(riskFilters.length === allRiskFilters.length)}
          >
            Todos
          </button>
          {[{ key: "HIGH", label: "Alto" }, { key: "MEDIUM", label: "Médio" }, { key: "LOW", label: "Baixo" }, { key: "UNMAPPED", label: "Sem mapeamento" }].map((option) => {
            const active = riskFilters.includes(option.key);
            return <button key={option.key} type="button" data-testid={includeRiskTestIds ? `companies-risk-filter-${option.key}` : undefined} onClick={() => onRiskFilterClick(option.key)} className={chipClass(active)}>{option.label}</button>;
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
        <div className="flex flex-wrap gap-2">
          {[{ key: "valido", label: "Válido" }, { key: "vencendo", label: "Vencendo" }, { key: "vencido", label: "Vencido" }, { key: "sem_certificado", label: "Sem certificado" }].map((option) => {
            const active = certFilters.includes(option.key);
            return <button key={option.key} type="button" onClick={() => toggleMultiFilter(setCertFilters, option.key)} className={chipClass(active)}>{option.label}</button>;
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
        {municipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {municipioOptions.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white"><input type="checkbox" checked={municipioFilters.includes(item)} onChange={() => toggleMultiFilter(setMunicipioFilters, item)} /><span>{item}</span></label>)}
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
        <div className="relative h-6">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300"
            style={{ left: `${urgencyMin}%`, width: `${Math.max(0, urgencyMax - urgencyMin)}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={urgencyMin}
            onChange={(event) => setUrgencyMin(Math.min(Number(event.target.value), urgencyMax))}
            className="ec-urgency-range"
            aria-label="Score de urgência mínimo"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={urgencyMax}
            onChange={(event) => setUrgencyMax(Math.max(Number(event.target.value), urgencyMin))}
            className="ec-urgency-range"
            aria-label="Score de urgência máximo"
          />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{urgencyMin}</span><span>{urgencyMax}</span></div>
      </div>

      {porteOptions.length > 0 ? <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Porte</p><div className="flex flex-wrap gap-2">{porteOptions.map((item) => <button key={item} type="button" onClick={() => toggleMultiFilter(setPorteFilters, item)} className={chipClass(porteFilters.includes(item))}>{item}</button>)}</div></div> : null}
      {responsavelOptions.length > 0 ? <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Responsável fiscal</p><div className="max-h-40 space-y-1 overflow-y-auto pr-1">{responsavelOptions.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white"><input type="checkbox" checked={responsavelFilters.includes(item)} onChange={() => toggleMultiFilter(setResponsavelFilters, item)} /><span className="truncate">{item}</span></label>)}</div></div> : null}

      <div className="flex justify-end gap-2 pt-1"><Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearRailFilters}>Limpar</Button></div>
    </aside>
  );
}
