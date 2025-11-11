import api from "@/lib/api";

const DEFAULT_PAGE_SIZE = 100;

export async function listarAlertas(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    sort: "dias_restantes",
    ...params,
  };
  const { data } = await api.get("/alertas", { params: query });
  return data;
}
