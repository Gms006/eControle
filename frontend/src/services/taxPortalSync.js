import { fetchJson } from "@/lib/api";

export const startTaxPortalSync = async ({ password, dry_run, municipio, limit }) =>
  fetchJson("/api/v1/dev/taxas/portal-sync/start", {
    method: "POST",
    body: { password, dry_run, municipio, limit },
  });

export const getActiveTaxPortalSyncRun = async () =>
  fetchJson("/api/v1/dev/taxas/portal-sync/active");

export const getTaxPortalSyncStatus = async (runId) =>
  fetchJson(`/api/v1/dev/taxas/portal-sync/${runId}`);

export const cancelTaxPortalSync = async (runId) =>
  fetchJson(`/api/v1/dev/taxas/portal-sync/${runId}/cancel`, {
    method: "POST",
    body: {},
  });
