import { fetchJson } from "@/lib/api";

export const listarAlertas = async (params = {}) => {
  const { page, size, sort, tipo_alerta, empresa_id } = params;
  return fetchJson("/api/v1/alertas", {
    query: { page, size, sort, tipo_alerta, empresa_id },
  });
};

export const listarTendenciaAlertas = async () => {
  return fetchJson("/api/v1/alertas/tendencia");
};
