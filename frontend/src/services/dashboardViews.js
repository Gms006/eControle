import { fetchJson } from "@/lib/api";

export const listarDashboardViews = async ({ tabKey = "painel", limit = 100, offset = 0 } = {}) => {
  return fetchJson("/api/v1/dashboard/views", {
    query: { tab_key: tabKey, limit, offset },
  });
};

export const criarDashboardView = async (payload) => {
  return fetchJson("/api/v1/dashboard/views", {
    method: "POST",
    body: payload,
  });
};

export const atualizarDashboardView = async (viewId, payload) => {
  if (!viewId) throw new Error("viewId obrigatorio");
  return fetchJson(`/api/v1/dashboard/views/${viewId}`, {
    method: "PATCH",
    body: payload,
  });
};

export const excluirDashboardView = async (viewId) => {
  if (!viewId) throw new Error("viewId obrigatorio");
  return fetchJson(`/api/v1/dashboard/views/${viewId}`, {
    method: "DELETE",
  });
};
