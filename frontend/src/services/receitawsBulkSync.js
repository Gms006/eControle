import { fetchJson } from "@/lib/api";

export const startReceitaWSBulkSync = async ({ password, dry_run, only_missing }) =>
  fetchJson("/api/v1/dev/receitaws/bulk-sync/start", {
    method: "POST",
    body: { password, dry_run, only_missing },
  });

export const getReceitaWSBulkSyncStatus = async (runId) =>
  fetchJson(`/api/v1/dev/receitaws/bulk-sync/${runId}`);

export const cancelReceitaWSBulkSync = async (runId) =>
  fetchJson(`/api/v1/dev/receitaws/bulk-sync/${runId}/cancel`, {
    method: "POST",
    body: {},
  });

export const getActiveReceitaWSBulkSyncRun = async () =>
  fetchJson("/api/v1/dev/receitaws/bulk-sync/active");
