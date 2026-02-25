import { fetchJson } from "@/lib/api";

export const listarEmpresas = async (params = {}) => {
  const { page, size, limit, offset, sort, municipio, q, porte, categoria } = params;
  const resolvedLimit = limit ?? size ?? 1000;
  const resolvedOffset =
    offset ?? (page && resolvedLimit ? Math.max(0, (Number(page) - 1) * Number(resolvedLimit)) : undefined);
  return fetchJson("/api/v1/companies", {
    query: {
      limit: resolvedLimit,
      offset: resolvedOffset,
      sort,
      municipio,
      q,
      porte,
      categoria,
    },
  });
};

export const obterEmpresa = async (empresaId) => {
  return fetchJson(`/api/v1/companies/${empresaId}`);
};

export const criarEmpresa = async (payload) => {
  return fetchJson("/api/v1/companies", { method: "POST", body: payload });
};

export const atualizarEmpresa = async (empresaId, payload) => {
  return fetchJson(`/api/v1/companies/${empresaId}`, { method: "PATCH", body: payload });
};
