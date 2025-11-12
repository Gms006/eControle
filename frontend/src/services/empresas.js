import { fetchJson } from "@/lib/api";

export const listarEmpresas = async (params = {}) => {
  const { page, size, sort, municipio, q, porte, categoria } = params;
  return fetchJson("/api/v1/empresas", {
    query: { page, size, sort, municipio, q, porte, categoria },
  });
};
