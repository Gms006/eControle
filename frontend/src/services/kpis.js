import { fetchJson } from "@/lib/api";

export const listarGruposKPIs = async (params = {}) => {
  const { grupo, page, size, sort } = params;
  return fetchJson("/api/v1/grupos/kpis", {
    query: { grupo, page, size, sort },
  });
};
