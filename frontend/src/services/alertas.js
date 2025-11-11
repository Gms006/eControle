import api from "@/lib/api";

const DEFAULT_PAGE_SIZE = 100;

const clampPageSize = (value) => {
  const number = Number(value ?? DEFAULT_PAGE_SIZE);
  if (Number.isNaN(number)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.max(number, 1), DEFAULT_PAGE_SIZE);
};

export async function listarAlertas(params = {}) {
  const { page, size, sort, ...rest } = params;
  const query = {
    page: Number(page ?? 1) || 1,
    size: clampPageSize(size),
    sort: sort ?? "dias_restantes",
    ...rest,
  };
  const { data } = await api.get("/alertas", { params: query });
  return data;
}
