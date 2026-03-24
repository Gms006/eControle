import React from "react";
import { Input } from "@/components/ui/input";
import OverlayModal from "@/components/ui/OverlayModal";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/DrawerFormPrimitives";

export default function BulkSyncManager({ bulk }) {
  return (
    <>
      <OverlayModal
        open={bulk.startModalOpen}
        title="Atualizar empresas em lote (ReceitaWS)"
        onClose={bulk.closeStartModal}
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={bulk.closeStartModal}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" disabled={bulk.starting} onClick={() => void bulk.start()}>
              {bulk.starting ? "Iniciando..." : "Iniciar"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Ação DEV-only. Processo assíncrono, com limite de 3 consultas/min (20s por chamada) e pode levar horas.
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>DRY-RUN (não grava no banco)</span>
            <input
              type="checkbox"
              checked={bulk.dryRun}
              onChange={(e) => bulk.setDryRun(e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>ONLY-MISSING (somente campos vazios/nulos/"-")</span>
            <input
              type="checkbox"
              checked={bulk.onlyMissing}
              onChange={(e) => bulk.setOnlyMissing(e.target.checked)}
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Senha
            </label>
            <Input
              type="password"
              value={bulk.password}
              onChange={(e) => bulk.setPassword(e.target.value)}
              placeholder="Confirme sua senha"
            />
          </div>

          {bulk.error ? <p className="text-sm text-rose-600">{bulk.error}</p> : null}
        </div>
      </OverlayModal>

      <OverlayModal
        open={bulk.runModalOpen}
        title={`Progresso do run ${bulk.runId || ""}`}
        onClose={() => void bulk.closeRun()}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">Status: {bulk.runStatus?.status || "carregando"}</div>
            <div className="flex items-center gap-2">
              <SecondaryButton type="button" onClick={bulk.minimize}>
                Minimizar
              </SecondaryButton>

              {["completed", "failed", "cancelled"].includes(String(bulk.runStatus?.status || "")) ? null : (
                <SecondaryButton type="button" onClick={() => void bulk.cancel()}>
                  Cancelar run
                </SecondaryButton>
              )}

              <PrimaryButton type="button" onClick={() => bulk.setDetailsOpen((prev) => !prev)}>
                {bulk.detailsOpen ? "Ocultar detalhes" : "Ver detalhes do run"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>
                {Number(bulk.runStatus?.processed || 0)} / {Number(bulk.runStatus?.total || 0)}
              </span>
              <span>{bulk.progressPercent}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${bulk.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border p-2">OK: {Number(bulk.runStatus?.ok_count || 0)}</div>
            <div className="rounded border p-2">Falhas: {Number(bulk.runStatus?.error_count || 0)}</div>
            <div className="rounded border p-2">Skipped: {Number(bulk.runStatus?.skipped_count || 0)}</div>
            <div className="rounded border p-2">Atual: {bulk.runStatus?.current_cnpj || "—"}</div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Últimos 5 erros</p>
            <div className="space-y-1 text-xs">
              {(bulk.runStatus?.errors || []).slice(-5).map((item, index) => (
                <div key={`${item?.cnpj || "err"}-${index}`} className="rounded border border-rose-200 bg-rose-50 p-2">
                  {item?.cnpj || "sem cnpj"}: {item?.error || "erro"}
                </div>
              ))}
              {!bulk.runStatus?.errors?.length ? (
                <div className="text-slate-500">Sem erros até o momento.</div>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {bulk.runStatus?.dry_run ? "Mudanças que seriam aplicadas" : "Mudanças aplicadas"}
            </p>
            <p className="mb-2 text-xs text-slate-600">
              Empresas com mudanças: {Number(bulk.runStatus?.changes_summary?.companies_with_changes || 0)}
            </p>
            <div className="space-y-1 text-xs">
              {bulk.fieldCounters.map(([field, count]) => (
                <div key={field} className="rounded border p-2">
                  {field}: {Number(count || 0)}
                </div>
              ))}
              {bulk.fieldCounters.length === 0 ? (
                <div className="text-slate-500">Sem alterações registradas.</div>
              ) : null}
            </div>
          </div>

          {bulk.detailsOpen ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                JSON resumido
              </p>
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(
                  {
                    run_id: bulk.runStatus?.run_id,
                    status: bulk.runStatus?.status,
                    dry_run: bulk.runStatus?.dry_run,
                    only_missing: bulk.runStatus?.only_missing,
                    total: bulk.runStatus?.total,
                    processed: bulk.runStatus?.processed,
                    ok_count: bulk.runStatus?.ok_count,
                    error_count: bulk.runStatus?.error_count,
                    skipped_count: bulk.runStatus?.skipped_count,
                    changes_summary: bulk.runStatus?.changes_summary,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : null}
        </div>
      </OverlayModal>

      {bulk.runMinimized && bulk.runId ? (
        <div className="fixed right-4 top-[72px] z-[2147483647] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
          <button type="button" className="text-left" onClick={bulk.restore} title="Restaurar progresso do run">
            <p className="text-[11px] font-semibold text-slate-800">Run ReceitaWS</p>
            <p className="text-[11px] text-slate-600">
              {Number(bulk.runStatus?.processed || 0)}/{Number(bulk.runStatus?.total || 0)} ({bulk.progressPercent}%)
            </p>
          </button>
          <SecondaryButton type="button" onClick={bulk.restore}>
            Abrir
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void bulk.closeRun()}>
            Fechar
          </SecondaryButton>
        </div>
      ) : null}

      {bulk.toastMessage ? (
        <div className="fixed bottom-4 right-4 z-[2147483647] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-lg">
          {bulk.toastMessage}
        </div>
      ) : null}
    </>
  );
}