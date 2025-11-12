import api, { API_ROOT } from "@/lib/api";

const DEFAULT_PAGE_SIZE = 200;

export async function listarRequerimentos(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    sort: "-mtime",
    ...params,
  };
  const { data } = await api.get("/uteis/requerimentos", { params: query });
  return data;
}

export async function listarContatos(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    ...params,
  };
  const { data } = await api.get("/uteis/contatos", { params: query });
  return data;
}

export async function listarModelos(params = {}) {
  const query = {
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    ...params,
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
