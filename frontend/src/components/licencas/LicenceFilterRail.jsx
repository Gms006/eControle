import React from "react";
import { Button } from "@/components/ui/button";

export default function LicenceFilterRail({
  filteredBaseLength,
  railActiveCount,
  kpis,
  setKpiFilter,
  kpiFilter,
  setPriorityGroup,
  priorityGroup,
  groupConfig,
  railStatusFilter,
  setRailStatusFilter,
  setRailRiskFilters,
  railRiskFilters,
  toggleRailFilter,
  railCertFilters,
  setRailCertFilters,
  railMunicipioOptions,
  railMunicipioFilters,
  setRailMunicipioFilters,
  railSanitaryComplexityFilter,
  setRailSanitaryComplexityFilter,
  railSanitaryComplexityOptions,
  formatSanitaryComplexityLabel,
  railUrgencyMin,
  railUrgencyMax,
  setRailUrgencyMin,
  setRailUrgencyMax,
  clearSharedRailFilters,
}) {
  const railChipClass = (active) =>
    [
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white",
    ].join(" ");

  return (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
          <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
          <p className="text-xs text-slate-500">Registros no recorte: {filteredBaseLength}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
          <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
          <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {kpis.map((item) => (
            <button key={item.key} type="button" onClick={() => setKpiFilter(item.key)} className={railChipClass(kpiFilter === item.key)}>
              {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{item.value}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPriorityGroup("todos")} className={railChipClass(priorityGroup === "todos")}>Todas criticidades</button>
          {groupConfig.map((cfg) => (
            <button key={cfg.key} type="button" onClick={() => setPriorityGroup(cfg.key)} className={railChipClass(priorityGroup === cfg.key)}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
        <div className="flex flex-wrap gap-2">
          {["ativas", "inativas", "todas"].map((value) => (
            <button key={value} type="button" onClick={() => setRailStatusFilter(value)} className={railChipClass(railStatusFilter === value)}>
              {value === "ativas" ? "Ativas" : value === "inativas" ? "Inativas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRailRiskFilters(["HIGH", "MEDIUM", "LOW", "UNMAPPED"])} className={railChipClass(railRiskFilters.length === 4)}>
            Todos
          </button>
          {[{ key: "HIGH", label: "Alto" }, { key: "MEDIUM", label: "Médio" }, { key: "LOW", label: "Baixo" }, { key: "UNMAPPED", label: "Sem mapeamento" }].map((option) => (
            <button key={option.key} type="button" onClick={() => toggleRailFilter(setRailRiskFilters, option.key)} className={railChipClass(railRiskFilters.includes(option.key))}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
        <div className="flex flex-wrap gap-2">
          {[{ key: "valido", label: "Válido" }, { key: "vencendo", label: "Vencendo" }, { key: "vencido", label: "Vencido" }, { key: "sem_certificado", label: "Sem certificado" }].map((option) => (
            <button key={option.key} type="button" onClick={() => toggleRailFilter(setRailCertFilters, option.key)} className={railChipClass(railCertFilters.includes(option.key))}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
        {railMunicipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {railMunicipioOptions.map((item) => (
            <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
              <input type="checkbox" checked={railMunicipioFilters.includes(item)} onChange={() => toggleRailFilter(setRailMunicipioFilters, item)} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Complexidade sanitária</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRailSanitaryComplexityFilter("todas")} className={railChipClass(railSanitaryComplexityFilter === "todas")}>
            Todas
          </button>
          {railSanitaryComplexityOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRailSanitaryComplexityFilter(value)}
              className={railChipClass(railSanitaryComplexityFilter === value)}
            >
              {formatSanitaryComplexityLabel(value)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
        <div className="relative h-6">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
          <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${railUrgencyMin}%`, width: `${Math.max(0, railUrgencyMax - railUrgencyMin)}%` }} />
          <input type="range" min={0} max={100} value={railUrgencyMin} onChange={(event) => setRailUrgencyMin(Math.min(Number(event.target.value), railUrgencyMax))} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
          <input type="range" min={0} max={100} value={railUrgencyMax} onChange={(event) => setRailUrgencyMax(Math.max(Number(event.target.value), railUrgencyMin))} className="ec-urgency-range" aria-label="Score de urgência máximo" />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{railUrgencyMin}</span><span>{railUrgencyMax}</span></div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearSharedRailFilters}>
          Limpar
        </Button>
      </div>
    </aside>
  );
}

