import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelTaxPortalSync,
  getActiveTaxPortalSyncRun,
  getTaxPortalSyncStatus,
  startTaxPortalSync,
} from "@/services/taxPortalSync";

const POLL_MS = 3000;
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function useTaxPortalSync({ canManage, onRefresh }) {
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runMinimized, setRunMinimized] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [password, setPassword] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [municipio, setMunicipio] = useState("ANÁPOLIS");
  const [limit, setLimit] = useState("");
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState(null);
  const terminalStatusNotifiedRef = useRef("");

  const progressPercent = useMemo(() => {
    const total = Number(runStatus?.total || 0);
    const processed = Number(runStatus?.processed || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  }, [runStatus?.processed, runStatus?.total]);

  const isTerminal = TERMINAL_RUN_STATUSES.has(String(runStatus?.status || ""));
  const canCancel = canManage && !isTerminal && ["queued", "running"].includes(String(runStatus?.status || ""));

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const fetchRunStatus = useCallback(
    async (currentRunId) => {
      if (!currentRunId || !canManage) return;

      setLoading(true);
      try {
        const data = await getTaxPortalSyncStatus(currentRunId);
        setRunStatus(data || null);
        setError("");

        const status = String(data?.status || "");
        const notifyKey = `${currentRunId}:${status}`;
        if (TERMINAL_RUN_STATUSES.has(status) && terminalStatusNotifiedRef.current !== notifyKey) {
          terminalStatusNotifiedRef.current = notifyKey;
          onRefresh?.("tax-portal-sync");
          if (status === "completed") setToastMessage("Tax Portal Sync concluído");
          if (status === "cancelled") setToastMessage("Run cancelado");
          if (status === "failed") setToastMessage("Run falhou");
        }
      } catch {
        setError("Falha ao consultar progresso do run.");
      } finally {
        setLoading(false);
      }
    },
    [canManage, onRefresh],
  );

  useEffect(() => {
    if (!canManage || !runId) return;

    let active = true;

    const load = async () => {
      try {
        const data = await getTaxPortalSyncStatus(runId);
        if (!active) return;
        setRunStatus(data || null);
        setError("");
      } catch {
        if (!active) return;
        setError("Falha ao consultar progresso do run.");
      }
    };

    void load();

    const timer = setInterval(() => {
      if (TERMINAL_RUN_STATUSES.has(String(runStatus?.status || ""))) return;
      void load();
    }, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [canManage, runId, runStatus?.status]);

  const resumeActiveRun = useCallback(async () => {
    if (!canManage) return false;

    try {
      const active = await getActiveTaxPortalSyncRun();
      const activeRunId = String(active?.run_id || "").trim();
      if (!activeRunId) return false;
      setRunId(activeRunId);
      setRunModalOpen(true);
      setRunMinimized(false);
      await fetchRunStatus(activeRunId);
      return true;
    } catch {
      return false;
    }
  }, [canManage, fetchRunStatus]);

  useEffect(() => {
    if (!canManage || runId) return;
    void resumeActiveRun();
  }, [canManage, runId, resumeActiveRun]);

  const closeStartModal = useCallback(() => {
    if (starting) return;
    setStartModalOpen(false);
    setError("");
    setPassword("");
  }, [starting]);

  const requestOpen = useCallback(async () => {
    if (!canManage) return;
    setError("");
    const resumed = await resumeActiveRun();
    if (resumed) return;
    setStartModalOpen(true);
  }, [canManage, resumeActiveRun]);

  const start = useCallback(async () => {
    if (!canManage) return;
    if (!password.trim()) {
      setError("Informe sua senha para confirmar.");
      return;
    }
    const municipioValue = municipio.trim();
    if (!municipioValue) {
      setError("Informe o município.");
      return;
    }

    const parsedLimit = String(limit || "").trim() ? Number(limit) : null;
    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 500)) {
      setError("Limite deve ser um número entre 1 e 500.");
      return;
    }

    setStarting(true);
    setError("");
    try {
      const response = await startTaxPortalSync({
        password: password.trim(),
        dry_run: dryRun,
        municipio: municipioValue,
        limit: parsedLimit === null ? null : Math.floor(parsedLimit),
      });
      const newRunId = String(response?.run_id || "").trim();
      if (!newRunId) throw new Error("Resposta inválida ao iniciar o run.");

      setRunId(newRunId);
      setStartModalOpen(false);
      setRunModalOpen(true);
      setRunMinimized(false);
      setDetailsOpen(false);
      setPassword("");
      terminalStatusNotifiedRef.current = "";
      await fetchRunStatus(newRunId);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("409")) {
        const resumed = await resumeActiveRun();
        if (!resumed) setError("Já existe um run ativo para esta organização.");
      } else if (message.includes("401")) {
        setError("Senha inválida.");
      } else {
        setError("Não foi possível iniciar o run.");
      }
    } finally {
      setStarting(false);
    }
  }, [canManage, dryRun, fetchRunStatus, limit, municipio, password, resumeActiveRun]);

  const cancel = useCallback(async () => {
    if (!canCancel || !runId) return;
    setCancelling(true);
    setError("");
    try {
      await cancelTaxPortalSync(runId);
      await fetchRunStatus(runId);
    } catch {
      setError("Falha ao cancelar o run.");
    } finally {
      setCancelling(false);
    }
  }, [canCancel, fetchRunStatus, runId]);

  const minimize = useCallback(() => {
    setRunModalOpen(false);
    setRunMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setRunModalOpen(true);
    setRunMinimized(false);
  }, []);

  const closeRun = useCallback(() => {
    setRunModalOpen(false);
    setDetailsOpen(false);
    if (!isTerminal) {
      setRunMinimized(true);
      return;
    }
    setRunMinimized(false);
    setRunId("");
    setRunStatus(null);
    terminalStatusNotifiedRef.current = "";
  }, [isTerminal]);

  return {
    startModalOpen,
    runModalOpen,
    runMinimized,
    detailsOpen,
    password,
    dryRun,
    municipio,
    limit,
    starting,
    loading,
    cancelling,
    error,
    runId,
    runStatus,
    toastMessage,
    progressPercent,
    canManage,
    canCancel,
    isTerminal,
    setPassword,
    setDryRun,
    setMunicipio,
    setLimit,
    setDetailsOpen,
    closeStartModal,
    requestOpen,
    start,
    cancel,
    minimize,
    restore,
    closeRun,
    resumeActiveRun,
  };
}
