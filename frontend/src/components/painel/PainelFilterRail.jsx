import { Button } from "@/components/ui/button";
import { Plus, Save, Star, Trash2 } from "lucide-react";

export default function PainelFilterRail({
  activeBadges,
  chipClass,
  panelFilters,
  setPanelFilters,
  focusTarget,
  riskOptions,
  certOptions,
  defaultRiskKeys,
  municipioOptions,
  viewsState,
  canManageShared,
  handleSaveCurrentView,
  handleTogglePin,
  handleRenameView,
  handleDeleteView,
  applySavedView,
}) {
  return (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
          <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
          <div className="text-sm font-semibold leading-4 text-blue-700">{activeBadges.length}</div>
          <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{activeBadges.length === 1 ? "ativo" : "ativos"}</div>
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, somenteAlertas: !prev.somenteAlertas }))} className={chipClass(panelFilters.somenteAlertas)}>
            Somente alertas
          </button>
          <button type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, modoFoco: !prev.modoFoco }))} className={chipClass(panelFilters.modoFoco)}>
            Modo foco
          </button>
        </div>
      </div>

      <div id="painel-critical_queues" className={`space-y-3 rounded-xl border p-3 ${focusTarget === "critical_queues" ? "border-blue-300 bg-blue-50/50" : "border-slate-300 bg-slate-200/50"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
        <div className="flex flex-wrap gap-2">
          {["Ativas", "Inativas", "Todas"].map((value) => (
            <button key={value} type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, companyStatus: value }))} className={chipClass(panelFilters.companyStatus === value)}>
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
        <div className="flex flex-wrap gap-2">
          {riskOptions.map((option) => {
            const active = panelFilters.riskKeys.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  setPanelFilters((prev) => {
                    const next = active ? prev.riskKeys.filter((entry) => entry !== option.key) : [...prev.riskKeys, option.key];
                    return { ...prev, riskKeys: next.length ? next : [...defaultRiskKeys] };
                  })
                }
                className={chipClass(active)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
        <div className="flex flex-wrap gap-2">
          {certOptions.map((option) => {
            const active = panelFilters.certBuckets.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  setPanelFilters((prev) => {
                    const next = active ? prev.certBuckets.filter((entry) => entry !== option.key) : [...prev.certBuckets, option.key];
                    return { ...prev, certBuckets: next.length ? next : [...certOptions.map((entry) => entry.key)] };
                  })
                }
                className={chipClass(active)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
        <select
          multiple
          value={panelFilters.municipio}
          onChange={(event) => {
            const values = Array.from(event.target.selectedOptions).map((opt) => opt.value);
            setPanelFilters((prev) => ({ ...prev, municipio: values }));
          }}
          className="min-h-[92px] w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
        >
          {municipioOptions.filter((item) => item !== "todos").map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <p className="text-[11px] text-slate-500">Segure Ctrl/Cmd para selecionar múltiplos.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
        <div className="relative h-6">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300"
            style={{
              left: `${panelFilters.urgencyMin}%`,
              width: `${Math.max(0, panelFilters.urgencyMax - panelFilters.urgencyMin)}%`,
            }}
          />
          <input type="range" min={0} max={100} value={panelFilters.urgencyMin} onChange={(e) => { const v = Number(e.target.value); setPanelFilters((prev) => ({ ...prev, urgencyMin: Math.min(v, prev.urgencyMax) })); }} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
          <input type="range" min={0} max={100} value={panelFilters.urgencyMax} onChange={(e) => { const v = Number(e.target.value); setPanelFilters((prev) => ({ ...prev, urgencyMax: Math.max(v, prev.urgencyMin) })); }} className="ec-urgency-range" aria-label="Score de urgência máximo" />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500">
          <span>{panelFilters.urgencyMin}</span>
          <span>{panelFilters.urgencyMax}</span>
        </div>
      </div>

      <div id="painel-saved_views" className={`space-y-2 rounded-xl border p-3 ${focusTarget === "saved_views" ? "border-blue-300 bg-blue-50/50" : "border-slate-300 bg-slate-200/50"}`}>
        <div className="flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">Views salvas</p><Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleSaveCurrentView}><Plus className="mr-1 h-3.5 w-3.5" /> Salvar</Button></div>
        {viewsState.loading ? <p className="text-xs text-slate-500">Carregando views...</p> : null}
        {!viewsState.loading && viewsState.items.length === 0 ? <p className="text-xs text-slate-500">Nenhuma view salva.</p> : null}
        {viewsState.items.map((entry) => {
          const filtersCount = Object.keys(entry?.payload_json?.filters || {}).length;
          return (
            <div key={entry.id} className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{entry.name}</p>
                  <p className="text-[11px] text-slate-500">{entry.scope === "shared" ? "Compartilhada" : "Pessoal"} · {filtersCount} filtros</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void handleTogglePin(entry)} className={`rounded-md p-1 ${entry.is_pinned ? "text-amber-600" : "text-slate-400"}`}><Star className="h-3.5 w-3.5" /></button>
                  {(entry.scope === "personal" || canManageShared) ? <><button type="button" onClick={() => void handleRenameView(entry)} className="rounded-md p-1 text-slate-500"><Save className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handleDeleteView(entry)} className="rounded-md p-1 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></> : null}
                </div>
              </div>
              <div className="mt-2 flex justify-end"><Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applySavedView(entry)}>Aplicar visão</Button></div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
