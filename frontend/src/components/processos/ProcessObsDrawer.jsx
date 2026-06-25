import React from "react";
import { Clock, MoveRight, PanelRightClose, RefreshCw, X } from "lucide-react";
import { normalizeText } from "@/lib/text";

export default function ProcessObsDrawer({
  obsDrawer,
  closeObsDrawer,
  getTipoDisplay,
  savingObs,
  obsDraft,
  setObsDraft,
  saveObs,
  loadingHistory,
  resolveProcessId,
  fetchObsHistory,
  historyError,
  obsHistory,
  formatDateTime,
}) {
  if (!(obsDrawer.open && obsDrawer.processo)) return null;

  return (
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
              {getTipoDisplay(obsDrawer.processo.tipo)} — Protocolo {obsDrawer.processo.protocolo || "—"}
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
  );
}
