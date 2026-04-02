import { fetchJson } from "@/lib/api";

export const listarNotificacoes = async (params = {}) => {
  const { limit = 20, offset = 0 } = params;
  return fetchJson("/api/v1/notificacoes", { query: { limit, offset } });
};

export const contarNotificacoesNaoLidas = async () => {
  return fetchJson("/api/v1/notificacoes/unread-count");
};

export const marcarNotificacaoComoLida = async (id) => {
  if (!id) {
    throw new Error("id de notificacao obrigatorio");
  }
  return fetchJson(`/api/v1/notificacoes/${id}/read`, { method: "POST" });
};
