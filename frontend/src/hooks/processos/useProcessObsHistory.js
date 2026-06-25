import { useCallback, useState } from "react";
import { fetchJson } from "@/lib/api";

export default function useProcessObsHistory({ resolveProcessId }) {
  const [obsDrawer, setObsDrawer] = useState({ open: false, processo: null });
  const [obsDraft, setObsDraft] = useState("");
  const [obsHistory, setObsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsOverrides, setObsOverrides] = useState({});
  const [historyError, setHistoryError] = useState(null);

  const fetchObsHistory = useCallback(async (processoId) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await fetchJson(`/api/v1/processos/${processoId}/obs-history`);
      setObsHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao carregar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const openObsDrawer = useCallback(
    (processo) => {
      const processId = resolveProcessId(processo);
      if (!processId) return;
      setObsDrawer({ open: true, processo });
      setObsDraft(obsOverrides[processId] ?? processo.obs ?? "");
      fetchObsHistory(processId);
    },
    [fetchObsHistory, obsOverrides, resolveProcessId],
  );

  const closeObsDrawer = useCallback(() => {
    setObsDrawer({ open: false, processo: null });
    setObsHistory([]);
    setHistoryError(null);
  }, []);

  const saveObs = useCallback(async () => {
    const processId = resolveProcessId(obsDrawer?.processo);
    if (!processId) return;
    setSavingObs(true);
    try {
      await fetchJson(`/api/v1/processos/${processId}/obs`, {
        method: "PATCH",
        body: { obs: obsDraft },
      });
      setObsOverrides((prev) => ({ ...prev, [processId]: obsDraft }));
      await fetchObsHistory(processId);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao salvar OBS.");
    } finally {
      setSavingObs(false);
    }
  }, [fetchObsHistory, obsDraft, obsDrawer?.processo, resolveProcessId]);

  const resolveObsValue = useCallback(
    (proc) => obsOverrides[resolveProcessId(proc)] ?? proc?.obs,
    [obsOverrides, resolveProcessId],
  );

  return {
    obsDrawer,
    obsDraft,
    setObsDraft,
    obsHistory,
    loadingHistory,
    savingObs,
    historyError,
    fetchObsHistory,
    openObsDrawer,
    closeObsDrawer,
    saveObs,
    resolveObsValue,
  };
}
