import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelReceitaWSBulkSync,
  getActiveReceitaWSBulkSyncRun,
  getReceitaWSBulkSyncStatus,
  startReceitaWSBulkSync,
} from "@/services/receitawsBulkSync";

const BULK_SYNC_POLL_MS = 3000;
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function useReceitaWsBulkSync({ isDevUser, onRefresh }) {
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runMinimized, setRunMinimized] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [password, setPassword] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const fetchRunStatus = useCallback(
    async (currentRunId) => {
      if (!currentRunId) return;
      const data = await getReceitaWSBulkSyncStatus(currentRunId);
      setRunStatus(data || null);

      if (TERMINAL_RUN_STATUSES.has(String(data?.status || ""))) {
        onRefresh?.("receitaws-bulk-sync");
        if (String(data?.status || "") === "completed") {
          setToastMessage("Concluído");
        }
      }
    },
    [onRefresh],
  );

  useEffect(() => {
    if (!runId) return;

    let active = true;

    const load = async () => {
      try {
        const data = await getReceitaWSBulkSyncStatus(runId);
        if (!active) return;
        setRunStatus(data || null);
      } catch {
        if (!active) return;
        setError("Falha ao consultar progresso do run.");
      }
    };

    void load();

    const timer = setInterval(() => {
      if (TERMINAL_RUN_STATUSES.has(String(runStatus?.status || ""))) return;
      void load();
    }, BULK_SYNC_POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [runId, runStatus?.status]);

  const progressPercent = useMemo(() => {
    const total = Number(runStatus?.total || 0);
    const processed = Number(runStatus?.processed || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  }, [runStatus?.processed, runStatus?.total]);

  const fieldCounters = useMemo(() => {
    const entries = Object.entries(runStatus?.changes_summary?.field_counters || {});
    return entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)).slice(0, 8);
  }, [runStatus?.changes_summary?.field_counters]);

  const closeStartModal = useCallback(() => {
    if (starting) return;
    setStartModalOpen(false);
    setError("");
    setPassword("");
  }, [starting]);

  const requestOpen = useCallback(async () => {
    if (!isDevUser) return;

    setError("");

    try {
      const active = await getActiveReceitaWSBulkSyncRun();
      const activeRunId = active?.run_id;

      if (activeRunId) {
        setRunId(activeRunId);
        setRunModalOpen(true);
        setRunMinimized(false);
        await fetchRunStatus(activeRunId);
        return;
      }
    } catch {
      // segue para modal inicial
    }

    setStartModalOpen(true);
  }, [fetchRunStatus, isDevUser]);

  const start = useCallback(async () => {
    if (!password) {
      setError("Informe sua senha para confirmar.");
      return;
    }

    setStarting(true);
    setError("");

    try {
      const response = await startReceitaWSBulkSync({
        password,
        dry_run: dryRun,
        only_missing: onlyMissing,
      });

      const newRunId = response?.run_id;
      if (!newRunId) {
        throw new Error("Resposta inválida ao iniciar o run.");
      }

      setRunId(newRunId);
      setPassword("");
      setStartModalOpen(false);
      setRunModalOpen(true);
      setRunMinimized(false);
      setDetailsOpen(false);

      await fetchRunStatus(newRunId);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("409")) {
        try {
          const active = await getActiveReceitaWSBulkSyncRun();
          const activeRunId = active?.run_id;
          if (activeRunId) {
            setRunId(activeRunId);
            setPassword("");
            setStartModalOpen(false);
            setRunModalOpen(true);
            setRunMinimized(false);
            await fetchRunStatus(activeRunId);
            return;
          }
        } catch {
          setError("Já existe um run ativo para esta organização.");
        }
      } else if (message.includes("401")) {
        setError("Senha inválida.");
      } else {
        setError("Não foi possível iniciar o run.");
      }
    } finally {
      setStarting(false);
    }
  }, [dryRun, fetchRunStatus, onlyMissing, password]);

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      await cancelReceitaWSBulkSync(runId);
      await fetchRunStatus(runId);
    } catch {
      setError("Falha ao cancelar o run.");
    }
  }, [fetchRunStatus, runId]);

  const minimize = useCallback(() => {
    setRunModalOpen(false);
    setRunMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setRunModalOpen(true);
    setRunMinimized(false);
  }, []);

  const closeRun = useCallback(async () => {
    const confirmed = window.confirm("Fechar esta janela vai cancelar o run atual. Deseja continuar?");
    if (!confirmed) return;

    if (!TERMINAL_RUN_STATUSES.has(String(runStatus?.status || "")) && runId) {
      try {
        await cancelReceitaWSBulkSync(runId);
      } catch {
        setError("Falha ao cancelar o run ao fechar a janela.");
        return;
      }
    }

    setRunModalOpen(false);
    setRunMinimized(false);
    setDetailsOpen(false);
    setRunId("");
    setRunStatus(null);
  }, [runId, runStatus?.status]);

  return {
    startModalOpen,
    runModalOpen,
    runMinimized,
    detailsOpen,
    password,
    dryRun,
    onlyMissing,
    starting,
    error,
    runId,
    runStatus,
    toastMessage,
    progressPercent,
    fieldCounters,
    setPassword,
    setDryRun,
    setOnlyMissing,
    setDetailsOpen,
    closeStartModal,
    requestOpen,
    start,
    cancel,
    minimize,
    restore,
    closeRun,
  };
}