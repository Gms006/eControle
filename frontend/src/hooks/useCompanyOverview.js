import React from "react";
import { obterEmpresaOverview } from "@/services/empresas";

export function useCompanyOverview(open, companyId) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const refetch = React.useCallback(async () => {
    if (!open || !companyId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await obterEmpresaOverview(companyId);
      setData(payload || null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Falha ao carregar visão geral da empresa.");
    } finally {
      setLoading(false);
    }
  }, [companyId, open]);

  React.useEffect(() => {
    if (!open || !companyId) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    refetch();
  }, [open, companyId, refetch]);

  return { data, loading, error, refetch, setData };
}

export default useCompanyOverview;
