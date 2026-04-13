import React, { useMemo, useState } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const severityClass = (severity) => {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "error") return "bg-rose-50 text-rose-900 border-rose-300 font-semibold";
  if (normalized === "warning") return "bg-amber-50 text-amber-900 border-amber-300 font-semibold";
  return "bg-sky-50 text-sky-900 border-sky-300 font-semibold";
};

export default function NotificationPanel({
  open,
  loading,
  notifications,
  unreadCount,
  onMarkRead,
  onNavigate,
  onLoadMore,
  hasMore,
  loadingMore,
  totalUnread,
}) {
  const [activeTab, setActiveTab] = useState("unread");
  const unreadItems = useMemo(
    () => (notifications || []).filter((item) => !item?.read_at),
    [notifications],
  );
  const readItems = useMemo(
    () => (notifications || []).filter((item) => Boolean(item?.read_at)),
    [notifications],
  );
  const visibleItems = activeTab === "read" ? readItems : unreadItems;

  if (!open) return null;

  return (
    <div
      className="absolute right-0 top-12 z-50 w-[min(420px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl"
      data-testid="notifications-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-bold text-slate-900">Notificacoes</div>
        <div className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-900 border border-rose-200" data-testid="notifications-unread-pill">
          {unreadCount} nao lida{unreadCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeTab === "unread" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => setActiveTab("unread")}
          data-testid="notifications-tab-unread"
        >
          Nao lidas
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "read" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => setActiveTab("read")}
          data-testid="notifications-tab-read"
        >
          Lidas
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Carregando...</div>
      ) : null}

      {!loading && visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {activeTab === "read" ? "Nenhuma notificacao lida." : "Nenhuma notificacao nao lida."}
        </div>
      ) : null}

      {!loading && visibleItems.length > 0 ? (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {visibleItems.map((item) => {
            const unread = !item?.read_at;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 transition-colors ${unread ? "border-slate-300 bg-slate-50 hover:bg-white" : "border-slate-200 bg-slate-100 hover:bg-slate-150"}`}
                data-testid="notification-item"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>
                        {String(item.severity || "info").toUpperCase()}
                      </span>
                      {unread ? <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Nao lida" /> : null}
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">{item.title || "Notificacao"}</div>
                    <div className="mt-1 text-xs text-slate-700 leading-relaxed">{item.message || "Sem mensagem."}</div>
                  </div>
                  <Bell className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600 font-medium">{formatDateTime(item.created_at)}</div>
                  <div className="flex items-center gap-2">
                    {item.route_path ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => onNavigate?.(item)}
                        data-testid="notification-open-route"
                      >
                        Abrir <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    ) : null}
                    {unread ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onMarkRead?.(item)}
                        data-testid="notification-mark-read"
                      >
                        Lida <Check className="ml-1 h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {activeTab === "unread" && hasMore ? (
            <div className="pt-2 pb-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs font-medium"
                onClick={() => onLoadMore?.()}
                disabled={loadingMore}
                data-testid="notification-load-more"
              >
                {loadingMore ? "Carregando..." : `Carregar mais (${totalUnread - visibleItems.length} restantes)`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
