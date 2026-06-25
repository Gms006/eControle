import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  Clock3,
  ExternalLink,
  Eye,
  Filter,
  Inbox,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoComoLida,
} from "@/services/notifications";

const NOTIFICATIONS_UI_STATE_KEY = "econtrole:notificacoes:ui-state";
const PAGE_SIZE = 60;
const NOTIFICATION_CLASS_ORDER = ["all", "licencas", "processos", "taxas", "empresas", "automacoes", "painel", "geral"];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const severityLabel = (severity) => {
  const normalized = String(severity || "info").toLowerCase();
  if (normalized === "error") return "Erro";
  if (normalized === "warning") return "Atenção";
  return "Info";
};

const severityClass = (severity) => {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
};

const notificationClassLabel = (value) => {
  if (value === "licencas") return "Licenças";
  if (value === "processos") return "Processos";
  if (value === "taxas") return "Taxas";
  if (value === "empresas") return "Empresas";
  if (value === "automacoes") return "Automações";
  if (value === "painel") return "Painel";
  if (value === "geral") return "Geral";
  return "Todas classes";
};

const notificationClassChipClass = (value) => {
  if (value === "licencas") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "processos") return "border-violet-200 bg-violet-50 text-violet-700";
  if (value === "taxas") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "empresas") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (value === "automacoes") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (value === "painel") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const resolveNotificationClass = (item) => {
  const eventType = String(item?.event_type || "").toLowerCase();
  const entityType = String(item?.entity_type || "").toLowerCase();
  const routePath = String(item?.route_path || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  const message = String(item?.message || "").toLowerCase();
  const text = `${eventType} ${entityType} ${routePath} ${title} ${message}`;

  if (text.includes("licenca") || text.includes("licença")) return "licencas";
  if (text.includes("process")) return "processos";
  if (text.includes("taxa") || text.includes("fiscal")) return "taxas";
  if (text.includes("empresa") || text.includes("receitaws") || text.includes("cnpj")) return "empresas";
  if (text.includes("job.") || text.includes("scan") || text.includes("worker") || text.includes("run")) return "automacoes";
  if (routePath.includes("/painel") || text.includes("painel")) return "painel";
  return "geral";
};

function KpiCard({ title, value, helper, icon: Icon, tone = "slate" }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-700";

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function NotificationCard({ item, onMarkRead, onNavigate }) {
  const unread = !item?.read_at;
  const itemClass = resolveNotificationClass(item);

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-sm transition-colors",
        unread ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", severityClass(item.severity))}>
              {severityLabel(item.severity)}
            </span>
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", notificationClassChipClass(itemClass))}>
              {notificationClassLabel(itemClass)}
            </span>
            {unread ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="Não lida" /> : null}
            {item?.route_path ? (
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Acionável
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-950">{item?.title || "Notificação"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item?.message || "Sem mensagem."}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
          <BellRing className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-700">Criada em:</span> {formatDateTime(item?.created_at)}
        </div>
        <div>
          <span className="font-semibold text-slate-700">Leitura:</span> {item?.read_at ? formatDateTime(item.read_at) : "Pendente"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {item?.route_path ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => onNavigate?.(item)}
          >
            Abrir contexto <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : null}
        {unread ? (
          <Button
            type="button"
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => onMarkRead?.(item)}
          >
            Marcar como lida <Check className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Eye className="mr-1 h-3.5 w-3.5" /> Lida
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function NotificacoesScreen({
  enqueueToast,
  onNotificationRouteNavigate,
  onUnreadCountChange,
}) {
  const loadSavedUiState = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(NOTIFICATIONS_UI_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const savedUiState = loadSavedUiState();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState(savedUiState?.search || "");
  const [statusFilter, setStatusFilter] = useState(savedUiState?.statusFilter || "all");
  const [severityFilter, setSeverityFilter] = useState(savedUiState?.severityFilter || "all");
  const [classFilter, setClassFilter] = useState(savedUiState?.classFilter || "all");
  const [onlyActionable, setOnlyActionable] = useState(savedUiState?.onlyActionable === true);

  const syncUnreadCount = useCallback(async () => {
    try {
      const payload = await contarNotificacoesNaoLidas();
      const nextUnread = Number(payload?.unread_count || 0);
      setUnreadCount(nextUnread);
      onUnreadCountChange?.(nextUnread);
    } catch {
      // no-op
    }
  }, [onUnreadCountChange]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    try {
      const payload = await listarNotificacoes({ limit: PAGE_SIZE, offset: 0 });
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setTotalAvailable(Number(payload?.total || nextItems.length));
    } catch (error) {
      setItems([]);
      setTotalAvailable(0);
      enqueueToast?.(error?.message || "Falha ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, [enqueueToast]);

  const loadMoreNotifications = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextOffset = offset + PAGE_SIZE;
      const payload = await listarNotificacoes({ limit: PAGE_SIZE, offset: nextOffset });
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems((prev) => [...prev, ...nextItems]);
      setOffset(nextOffset);
      setTotalAvailable(Number(payload?.total || nextOffset + nextItems.length));
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao carregar mais notificações.");
    } finally {
      setLoadingMore(false);
    }
  }, [enqueueToast, offset]);

  const refreshBoard = useCallback(async () => {
    await Promise.all([loadNotifications(), syncUnreadCount()]);
  }, [loadNotifications, syncUnreadCount]);

  const handleMarkRead = useCallback(async (item) => {
    if (!item?.id) return;
    try {
      await marcarNotificacaoComoLida(item.id);
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry,
        ),
      );
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        onUnreadCountChange?.(next);
        return next;
      });
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao marcar notificação como lida.");
    }
  }, [enqueueToast, onUnreadCountChange]);

  const handleOpenNotification = useCallback(async (item) => {
    if (!item) return;
    if (!item.read_at) {
      await handleMarkRead(item);
    }
    if (item.route_path) {
      onNotificationRouteNavigate?.(item.route_path);
    }
  }, [handleMarkRead, onNotificationRouteNavigate]);

  useEffect(() => {
    void refreshBoard();
    const interval = window.setInterval(() => {
      void refreshBoard();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [refreshBoard]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      NOTIFICATIONS_UI_STATE_KEY,
      JSON.stringify({ search, statusFilter, severityFilter, classFilter, onlyActionable }),
    );
  }, [classFilter, onlyActionable, search, severityFilter, statusFilter]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "unread" && item?.read_at) return false;
      if (statusFilter === "read" && !item?.read_at) return false;
      if (severityFilter !== "all" && String(item?.severity || "info").toLowerCase() !== severityFilter) return false;
      if (classFilter !== "all" && resolveNotificationClass(item) !== classFilter) return false;
      if (onlyActionable && !item?.route_path) return false;
      if (!query) return true;
      const haystack = [item?.title, item?.message, item?.route_path, item?.event_type, item?.entity_type]
        .map((entry) => String(entry || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [classFilter, items, onlyActionable, search, severityFilter, statusFilter]);

  const unreadItems = useMemo(() => filteredItems.filter((item) => !item?.read_at), [filteredItems]);
  const readItems = useMemo(() => filteredItems.filter((item) => Boolean(item?.read_at)), [filteredItems]);

  const stats = useMemo(() => {
    const actionable = items.filter((item) => Boolean(item?.route_path)).length;
    const byClass = items.reduce((acc, item) => {
      const key = resolveNotificationClass(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      total: items.length,
      unread: unreadCount,
      read: Math.max(0, items.length - unreadItems.length),
      actionable,
      byClass,
    };
  }, [items, unreadCount, unreadItems.length]);

  const activeBadges = useMemo(() => {
    const badges = [];
    if (search.trim()) badges.push({ key: "search", label: `Busca: ${search.trim()}`, onClear: () => setSearch("") });
    if (statusFilter !== "all") badges.push({ key: "status", label: `Status: ${statusFilter === "unread" ? "Não lidas" : "Lidas"}`, onClear: () => setStatusFilter("all") });
    if (severityFilter !== "all") badges.push({ key: "severity", label: `Severidade: ${severityLabel(severityFilter)}`, onClear: () => setSeverityFilter("all") });
    if (classFilter !== "all") badges.push({ key: "class", label: `Classe: ${notificationClassLabel(classFilter)}`, onClear: () => setClassFilter("all") });
    if (onlyActionable) badges.push({ key: "actionable", label: "Somente acionáveis", onClear: () => setOnlyActionable(false) });
    return badges;
  }, [classFilter, onlyActionable, search, severityFilter, statusFilter]);

  const hasMore = items.length < totalAvailable;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#fff7fb_45%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Central viva
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Notificações operacionais</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Uma visão simples para triagem do que acabou de chegar, do que já foi lido e do que ainda exige abertura de contexto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[250px] flex-1 xl:w-[320px] xl:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar título, mensagem ou rota"
                className="h-11 rounded-2xl border-slate-200 bg-white pl-9"
              />
            </div>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => void refreshBoard()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Carregadas" value={stats.total} helper="Itens atualmente em memória" icon={Inbox} />
        <KpiCard title="Não lidas" value={stats.unread} helper="Pendentes de leitura" icon={BellRing} tone="rose" />
        <KpiCard title="Lidas" value={readItems.length} helper="Já processadas nesta visão" icon={Eye} tone="emerald" />
        <KpiCard title="Acionáveis" value={stats.actionable} helper="Com rota ou contexto navegável" icon={ExternalLink} tone="blue" />
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setStatusFilter("all")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", statusFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>Todas</button>
            <button type="button" onClick={() => setStatusFilter("unread")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", statusFilter === "unread" ? "border-rose-600 bg-rose-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>Não lidas</button>
            <button type="button" onClick={() => setStatusFilter("read")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", statusFilter === "read" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>Lidas</button>
            <button type="button" onClick={() => setOnlyActionable((prev) => !prev)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", onlyActionable ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>Somente acionáveis</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["all", "info", "warning", "error"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverityFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  severityFilter === value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {value === "all" ? "Todas severidades" : severityLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {NOTIFICATION_CLASS_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setClassFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                classFilter === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : notificationClassChipClass(value),
              )}
            >
              {notificationClassLabel(value)}
              {value !== "all" ? (
                <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", classFilter === value ? "bg-white/20 text-white" : "bg-white/75 text-slate-700")}>
                  {stats.byClass?.[value] || 0}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeBadges.length === 0 ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Sem filtros adicionais ativos
            </span>
          ) : null}
          {activeBadges.map((badge) => (
            <button
              key={badge.key}
              type="button"
              onClick={badge.onClear}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              {badge.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Carregando notificações...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Não lidas</h3>
                <p className="text-sm text-slate-500">Priorize o que ainda não foi triado.</p>
              </div>
              <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <Clock3 className="mr-1.5 h-3.5 w-3.5" /> {unreadItems.length}
              </div>
            </div>
            {unreadItems.length === 0 ? (
              <EmptyState title="Nada pendente" description="Todas as notificações filtradas já foram lidas." />
            ) : (
              unreadItems.map((item) => (
                <NotificationCard key={item.id} item={item} onMarkRead={handleMarkRead} onNavigate={handleOpenNotification} />
              ))
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Lidas</h3>
                <p className="text-sm text-slate-500">Histórico recente já processado.</p>
              </div>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Eye className="mr-1.5 h-3.5 w-3.5" /> {readItems.length}
              </div>
            </div>
            {readItems.length === 0 ? (
              <EmptyState title="Nenhuma lida" description="As notificações lidas aparecerão aqui conforme forem processadas." />
            ) : (
              readItems.map((item) => (
                <NotificationCard key={item.id} item={item} onMarkRead={handleMarkRead} onNavigate={handleOpenNotification} />
              ))
            )}
          </section>
        </div>
      )}

      {!loading && hasMore ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" className="rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => void loadMoreNotifications()} disabled={loadingMore}>
            {loadingMore ? "Carregando..." : `Carregar mais (${Math.max(0, totalAvailable - items.length)} restantes)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
