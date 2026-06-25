import React from "react";
import { SideDrawer } from "@/components/ui/side-drawer";

export default function WorkerHealthDrawer({
  open,
  onClose,
  onRefresh,
  workerHealth,
  loading,
}) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      subtitle={"Opera\u00e7\u00e3o"}
      title={"Automa\u00e7\u00e3o / Jobs"}
      footer={(
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onRefresh}
          >
            {"Atualizar status"}
          </button>
        </div>
      )}
    >
      {loading ? <p className="text-sm text-slate-500">{"Carregando status do worker..."}</p> : null}
      {!loading && !workerHealth ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          {"N\u00e3o foi poss\u00edvel carregar o status do worker."}
        </div>
      ) : null}
      {!loading && workerHealth ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{"Backend"}</p>
            <p className="font-semibold text-slate-900">{String(workerHealth.backend || "-")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{"Status"}</p>
              <p className="font-semibold text-slate-900">{String(workerHealth.status || "-")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{"Jobs ativos"}</p>
              <p className="font-semibold text-slate-900">{Number(workerHealth.active_jobs || 0)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{"Suportados"}</p>
            <p className="text-slate-700">
              {Array.isArray(workerHealth.jobs_supported) ? workerHealth.jobs_supported.join(", ") : "-"}
            </p>
          </div>
        </div>
      ) : null}
    </SideDrawer>
  );
}
