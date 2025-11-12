import api, { API_ROOT } from "@/lib/api";

const DEFAULT_PAGE_SIZE = 100;

const clampPageSize = (value) => {
  const number = Number(value ?? DEFAULT_PAGE_SIZE);
  if (Number.isNaN(number)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.max(number, 1), DEFAULT_PAGE_SIZE);
};

export async function listarRequerimentos(params = {}) {
  const { page, size, sort, ...rest } = params;
  const query = {
    page: Number(page ?? 1) || 1,
    size: clampPageSize(size),
    sort: sort ?? "-mtime",
    ...rest,
  };
  const { data } = await api.get("/uteis/requerimentos", { params: query });
  return data;
}

export async function listarContatos(params = {}) {
  const { page, size, ...rest } = params;
  const query = {
    page: Number(page ?? 1) || 1,
    size: clampPageSize(size),
    ...rest,
  };
  const { data } = await api.get("/uteis/contatos", { params: query });
  return data;
}

export async function listarModelos(params = {}) {
  const { page, size, ...rest } = params;
  const query = {
    page: Number(page ?? 1) || 1,
    size: clampPageSize(size),
    ...rest,
  };
  const { data } = await api.get("/uteis/modelos", { params: query });
  return data;
}

export const urlArquivoRequerimento = (fileId, inline = true) => {
  if (!fileId) return "";
  const disposition = inline ? 1 : 0;
  return `${API_ROOT}/api/v1/uteis/requerimentos/download/${fileId}?inline=${disposition}`;
};

export const urlFoxit = (fileId) => {
  const baseUrl = urlArquivoRequerimento(fileId, true);
  if (!baseUrl) return "";
  return `openpdf://${encodeURIComponent(baseUrl)}`;
};
