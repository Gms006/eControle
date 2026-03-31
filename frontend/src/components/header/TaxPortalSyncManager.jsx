import React from "react";
import { Input } from "@/components/ui/input";
import OverlayModal from "@/components/ui/OverlayModal";
import { PrimaryButton, SecondaryButton } from "@/components/forms/DrawerFormPrimitives";

export default function TaxPortalSyncManager({ sync }) {
  if (!sync?.canManage) return null;

  const summary = sync?.runStatus?.summary && typeof sync.runStatus.summary === "object" ? sync.runStatus.summary : {};

  return (
    <>
      <OverlayModal
        open={sync.startModalOpen}
        title="Iniciar Tax Portal Sync"
        onClose={sync.closeStartModal}
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={sync.closeStartModal}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={sync.starting}
              data-testid="tax-portal-sync-start-submit"
              onClick={() => void sync.start()}
            >
              {sync.starting ? "Iniciando..." : "Iniciar"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Ação ADMIN/DEV. O processo é assíncrono e pode levar alguns minutos.
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>DRY-RUN (não grava em company_taxes)</span>
            <input
              type="checkbox"
              data-testid="tax-portal-sync-dry-run"
              checked={sync.dryRun}
              onChange={(event) => sync.setDryRun(event.target.checked)}
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Município
            </label>
            <Input
              value={sync.municipio}
              data-testid="tax-portal-sync-municipio"
              onChange={(event) => sync.setMunicipio(event.target.value)}
              placeholder="ANÁPOLIS"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Limite (opcional)
            </label>
            <Input
              type="number"
              min="1"
              max="500"
              value={sync.limit}
              data-testid="tax-portal-sync-limit"
              onChange={(event) => sync.setLimit(event.target.value)}
              placeholder="Ex.: 10"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Senha
            </label>
            <Input
              type="password"
              value={sync.password}
              data-testid="tax-portal-sync-password"
              onChange={(event) => sync.setPassword(event.target.value)}
              placeholder="Confirme sua senha"
            />
          </div>

          {sync.error ? <p className="text-sm text-rose-600">{sync.error}</p> : null}
        </div>
      </OverlayModal>

      <OverlayModal
        open={sync.runModalOpen}
        title={`Tax Portal Sync - run ${sync.runId || ""}`}
        onClose={sync.closeRun}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Status: {sync.runStatus?.status || (sync.loading ? "carregando" : "—")}
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton type="button" onClick={sync.minimize}>
                Minimizar
              </SecondaryButton>
              {sync.canCancel ? (
                <SecondaryButton
                  type="button"
                  data-testid="tax-portal-sync-cancel"
                  disabled={sync.cancelling}
                  onClick={() => void sync.cancel()}
                >
                  {sync.cancelling ? "Cancelando..." : "Cancelar run"}
                </SecondaryButton>
              ) : null}
              <PrimaryButton type="button" onClick={() => sync.setDetailsOpen((prev) => !prev)}>
                {sync.detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4" data-testid="tax-portal-sync-manager">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>
                {Number(sync.runStatus?.processed || 0)} / {Number(sync.runStatus?.total || 0)}
              </span>
              <span>{sync.progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${sync.progressPercent}%` }}
                data-testid="tax-portal-sync-progress"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border p-2">OK: {Number(sync.runStatus?.ok_count || 0)}</div>
            <div className="rounded border p-2">Falhas: {Number(sync.runStatus?.error_count || 0)}</div>
            <div className="rounded border p-2">Skipped: {Number(sync.runStatus?.skipped_count || 0)}</div>
            <div className="rounded border p-2">Relogin: {Number(sync.runStatus?.relogin_count || 0)}</div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-700 md:grid-cols-2">
            <div className="rounded border p-2">Município: {sync.runStatus?.municipio || "—"}</div>
            <div className="rounded border p-2">Dry-run: {sync.runStatus?.dry_run ? "Sim" : "Não"}</div>
            <div className="rounded border p-2">Run ID: {sync.runStatus?.run_id || sync.runId || "—"}</div>
            <div className="rounded border p-2">Limite: {sync.runStatus?.limit ?? "—"}</div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Últimos erros</p>
            <div className="space-y-1 text-xs">
              {(sync.runStatus?.errors || []).slice(-5).map((item, index) => (
                <div key={`${item?.cnpj || "err"}-${index}`} className="rounded border border-rose-200 bg-rose-50 p-2">
                  {item?.cnpj || "sem cnpj"}: {item?.error || "erro"}
                </div>
              ))}
              {!sync.runStatus?.errors?.length ? <div className="text-slate-500">Sem erros até o momento.</div> : null}
            </div>
          </div>

          {sync.isTerminal ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-semibold">
                Run finalizado com status: {String(sync.runStatus?.status || "").toUpperCase()}
              </p>
              <p>
                Processadas: {Number(sync.runStatus?.processed || 0)} de {Number(sync.runStatus?.total || 0)}
              </p>
              {"companies_with_debits" in summary ? (
                <p>Empresas com débitos: {Number(summary?.companies_with_debits || 0)}</p>
              ) : null}
              {"companies_marked_paid" in summary ? (
                <p>Empresas marcadas como pagas: {Number(summary?.companies_marked_paid || 0)}</p>
              ) : null}
            </div>
          ) : null}

          {sync.detailsOpen ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">JSON resumido</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(
                  {
                    run_id: sync.runStatus?.run_id,
                    status: sync.runStatus?.status,
                    dry_run: sync.runStatus?.dry_run,
                    municipio: sync.runStatus?.municipio,
                    limit: sync.runStatus?.limit,
                    total: sync.runStatus?.total,
                    processed: sync.runStatus?.processed,
                    ok_count: sync.runStatus?.ok_count,
                    error_count: sync.runStatus?.error_count,
                    skipped_count: sync.runStatus?.skipped_count,
                    relogin_count: sync.runStatus?.relogin_count,
                    summary: sync.runStatus?.summary,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : null}

          {sync.error ? <p className="text-sm text-rose-600">{sync.error}</p> : null}
        </div>
      </OverlayModal>

      {sync.runMinimized && sync.runId ? (
        <div className="fixed right-4 top-[72px] z-[2147483647] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
          <button type="button" className="text-left" onClick={sync.restore} title="Restaurar progresso do run">
            <p className="text-[11px] font-semibold text-slate-800">Tax Portal Sync</p>
            <p className="text-[11px] text-slate-600">
              {Number(sync.runStatus?.processed || 0)}/{Number(sync.runStatus?.total || 0)} ({sync.progressPercent}%)
            </p>
          </button>
          <SecondaryButton type="button" onClick={sync.restore}>
            Abrir
          </SecondaryButton>
        </div>
      ) : null}

      {sync.toastMessage ? (
        <div className="fixed bottom-4 right-4 z-[2147483647] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-lg">
          {sync.toastMessage}
        </div>
      ) : null}
    </>
  );
}
