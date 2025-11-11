import api from "@/lib/api";

const DEFAULT_PAGE_SIZE = 200;

export async function listarGruposKPIs(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    ...params,
  };
  const { data } = await api.get("/grupos/kpis", { params: query });
  return data;
}
