import { fetchJson } from "@/lib/api";

export const listarEmpresas = async (params = {}) => {
  const { page, size, sort, municipio, q, porte, categoria } = params;
  return fetchJson("/api/v1/empresas", {
    query: { page, size, sort, municipio, q, porte, categoria },
  });
};

export const obterEmpresa = async (empresaId) => {
  return fetchJson(`/api/v1/empresas/${empresaId}`);
};

export const criarEmpresa = async (payload) => {
  return fetchJson("/api/v1/empresas", { method: "POST", body: payload });
};

export const atualizarEmpresa = async (empresaId, payload) => {
  return fetchJson(`/api/v1/empresas/${empresaId}`, { method: "PATCH", body: payload });
};
