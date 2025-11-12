import api from "@/lib/api";

const DEFAULT_PAGE_SIZE = 100;

export async function listarEmpresas(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    ...params,
  };
  const { data } = await api.get("/empresas", { params: query });
  return data;
}
